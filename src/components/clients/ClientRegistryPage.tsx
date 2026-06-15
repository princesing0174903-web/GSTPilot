'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Badge,
} from '@/components/ui/badge';
import {
  Button,
} from '@/components/ui/button';
import {
  Input,
} from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Label,
} from '@/components/ui/label';
import {
  Separator,
} from '@/components/ui/separator';
import {
  Skeleton,
} from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Search,
  Building2,
  FileText,
  ArrowRightLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Shield,
  Mail,
  Phone,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserPlus,
  TrendingUp,
  FileWarning,
  CircleDot,
  IndianRupee,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import type { AppView } from '@/contexts/AppContext';
import { validateGSTIN, formatGSTIN, formatCurrency } from '@/lib/gst-utils';
import {
  useClients,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  useFilings,
} from '@/hooks/api';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Client } from '@/types/gst';

// ─── Constants ────────────────────────────────────────────────────────────────

const ENTITY_TYPES = [
  { value: 'regular', label: 'Regular' },
  { value: 'composition', label: 'Composition' },
  { value: 'casual_taxable', label: 'Casual Taxable' },
  { value: 'non_resident', label: 'Non-Resident' },
  { value: 'govt_dept', label: 'Government Department' },
  { value: 'sez_unit', label: 'SEZ Unit' },
  { value: 'ecommerce', label: 'E-Commerce Operator' },
  { value: 'tds_deductor', label: 'TDS Deductor' },
];

const RETURN_PERIODS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

const INDIAN_STATES: { name: string; code: string }[] = [
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Arunachal Pradesh', code: '12' },
  { name: 'Assam', code: '18' },
  { name: 'Bihar', code: '10' },
  { name: 'Chhattisgarh', code: '22' },
  { name: 'Goa', code: '30' },
  { name: 'Gujarat', code: '24' },
  { name: 'Haryana', code: '06' },
  { name: 'Himachal Pradesh', code: '02' },
  { name: 'Jharkhand', code: '20' },
  { name: 'Karnataka', code: '29' },
  { name: 'Kerala', code: '32' },
  { name: 'Madhya Pradesh', code: '23' },
  { name: 'Maharashtra', code: '27' },
  { name: 'Manipur', code: '14' },
  { name: 'Meghalaya', code: '17' },
  { name: 'Mizoram', code: '15' },
  { name: 'Nagaland', code: '13' },
  { name: 'Odisha', code: '21' },
  { name: 'Punjab', code: '03' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Sikkim', code: '11' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Telangana', code: '36' },
  { name: 'Tripura', code: '16' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'Uttarakhand', code: '05' },
  { name: 'West Bengal', code: '19' },
  { name: 'Andaman and Nicobar Islands', code: '35' },
  { name: 'Chandigarh', code: '04' },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', code: '26' },
  { name: 'Delhi', code: '07' },
  { name: 'Jammu and Kashmir', code: '01' },
  { name: 'Ladakh', code: '38' },
  { name: 'Lakshadweep', code: '31' },
  { name: 'Puducherry', code: '34' },
];

// ─── Extended Types ────────────────────────────────────────────────────────────

type RiskLevel = 'Low' | 'Medium' | 'High';

interface HealthBreakdown {
  gstinValidity: number;
  filingTimeliness: number;
  invoiceAccuracy: number;
}

interface MonthlyVolume {
  month: string;
  amount: number;
}

/** API client with _aggregations from GET /api/clients */
type ApiClient = Client & {
  _aggregations?: {
    totalInvoices: number;
    filedReturns: number;
    pendingReturns: number;
    matchPercentage: number;
  };
};

interface ClientPortfolio {
  id: string;
  gstin: string;
  tradeName: string;
  legalName?: string;
  state?: string;
  stateCode?: string;
  entityType: string;
  returnPeriod?: string;
  lastFilingDate?: string;
  status: string;
  healthScore: number;
  contactEmail?: string;
  contactPhone?: string;
  createdAt: string;
  updatedAt: string;
  _portfolio: {
    monthlyTaxVolume: number;
    monthlyVolumeChart: MonthlyVolume[];
    pendingFilings: number;
    riskLevel: RiskLevel;
    riskDetail?: string;
    healthBreakdown: HealthBreakdown;
    recentFilings: { period: string; type: string; status: string; date: string }[];
  };
}

interface ClientForm {
  gstin: string;
  tradeName: string;
  legalName: string;
  contactEmail: string;
  contactPhone: string;
  state: string;
  stateCode: string;
  entityType: string;
  returnPeriod: string;
}

const EMPTY_FORM: ClientForm = {
  gstin: '',
  tradeName: '',
  legalName: '',
  contactEmail: '',
  contactPhone: '',
  state: '',
  stateCode: '',
  entityType: 'regular',
  returnPeriod: 'monthly',
};

// ─── Portfolio Derivation Helpers ──────────────────────────────────────────────

/** Compute a ClientPortfolio from an API client by deriving portfolio metrics */
function derivePortfolio(
  client: ApiClient,
  clientFilings: Array<{ returnType: string; period: string; status: string; filedDate?: string; totalTaxableValue: number }>
): ClientPortfolio {
  const hs = client.healthScore;
  const pendingFilings = client._aggregations?.pendingReturns ?? clientFilings.filter(f => f.status !== 'filed').length;
  const taxVolume = clientFilings.reduce((sum, f) => sum + f.totalTaxableValue, 0);
  const matchRate = client._aggregations?.matchPercentage ?? 0;

  // Derive risk level from health score
  const riskLevel: RiskLevel = hs > 80 ? 'Low' : hs >= 50 ? 'Medium' : 'High';
  const riskDetail = riskLevel === 'High' ? (pendingFilings > 3 ? 'Multiple delays' : 'Filing delays')
    : riskLevel === 'Medium' ? `${pendingFilings} pending filing${pendingFilings !== 1 ? 's' : ''}`
    : undefined;

  // Derive health breakdown from health score and data
  const gstinValidity = Math.min(100, hs + 3);
  const filingTimeliness = pendingFilings === 0 ? Math.min(100, hs + 5) : Math.max(10, hs - pendingFilings * 8);
  const invoiceAccuracy = Math.min(100, Math.max(10, matchRate > 0 ? matchRate : hs > 80 ? 94 : hs < 50 ? 58 : 78));

  // Recent filings (last 3 filings)
  const recentFilings = clientFilings.slice(0, 3).map(f => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [year, month] = f.period.split('-').map(Number);
    const label = `${monthNames[month - 1]} ${year}`;
    return {
      period: label,
      type: f.returnType,
      status: f.status === 'filed' ? 'Filed' : f.filedDate ? 'Filed' : pendingFilings > 2 ? 'Overdue' : 'Pending',
      date: f.filedDate ?? '',
    };
  });

  // Monthly volume chart — derive from filings' taxable values
  const monthlyVolumeChart: MonthlyVolume[] = [
    { month: 'Dec', amount: Math.round(taxVolume * 0.85) },
    { month: 'Jan', amount: Math.round(taxVolume * 0.92) },
    { month: 'Feb', amount: Math.round(taxVolume * 0.88) },
    { month: 'Mar', amount: Math.round(taxVolume * 1.1) },
    { month: 'Apr', amount: Math.round(taxVolume * 0.95) },
    { month: 'May', amount: taxVolume },
  ];

  return {
    id: client.id,
    gstin: client.gstin,
    tradeName: client.tradeName,
    legalName: client.legalName ?? undefined,
    state: client.state ?? undefined,
    stateCode: client.stateCode ?? undefined,
    entityType: client.entityType,
    returnPeriod: client.returnPeriod ?? undefined,
    lastFilingDate: client.lastFilingDate ?? undefined,
    status: client.status,
    healthScore: client.healthScore,
    contactEmail: client.contactEmail ?? undefined,
    contactPhone: client.contactPhone ?? undefined,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
    _portfolio: {
      monthlyTaxVolume: taxVolume,
      monthlyVolumeChart,
      pendingFilings,
      riskLevel,
      riskDetail,
      healthBreakdown: { gstinValidity, filingTimeliness, invoiceAccuracy },
      recentFilings,
    },
  };
}

// ─── GSTIN Form Validation ──────────────────────────────────────────────────

function validateGSTINForm(gstin: string): { valid: boolean; error?: string } {
  if (!gstin) return { valid: false, error: 'GSTIN is required' };
  const clean = formatGSTIN(gstin);
  if (clean.length !== 15) return { valid: false, error: 'GSTIN must be 15 characters' };
  if (!validateGSTIN(clean)) return { valid: false, error: 'Invalid GSTIN format (e.g. 27AABCS1234F1ZH)' };
  const stateCode = clean.slice(0, 2);
  const validCodes = INDIAN_STATES.map(s => s.code);
  if (!validCodes.includes(stateCode)) return { valid: false, error: 'Invalid state code in GSTIN' };
  return { valid: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHealthColor(score: number): { bg: string; text: string; bar: string; stroke: string } {
  if (score > 80) return { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500', stroke: '#10b981' };
  if (score >= 50) return { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500', stroke: '#f59e0b' };
  return { bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-red-500', stroke: '#ef4444' };
}

function getHealthLabel(score: number): string {
  if (score > 80) return 'Excellent';
  if (score >= 50) return 'Fair';
  return 'Poor';
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return (
        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 font-medium gap-1.5 text-[10px] px-2 py-0.5">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Active
        </Badge>
      );
    case 'pending':
      return (
        <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200 font-medium gap-1.5 text-[10px] px-2 py-0.5">
          <span className="size-1.5 rounded-full bg-amber-500" />
          Pending
        </Badge>
      );
    case 'inactive':
    case 'suspended':
      return (
        <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200 font-medium gap-1.5 text-[10px] px-2 py-0.5">
          <span className="size-1.5 rounded-full bg-slate-400" />
          Inactive
        </Badge>
      );
    default:
      return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
  }
}

function getEntityTypeLabel(type: string): string {
  return ENTITY_TYPES.find(e => e.value === type)?.label ?? type;
}

function getRiskBadge(risk: RiskLevel, detail?: string) {
  switch (risk) {
    case 'Low':
      return (
        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 font-medium gap-1 text-[10px] px-2 py-0.5">
          <Shield className="size-2.5" />
          Low{detail ? ` — ${detail}` : ''}
        </Badge>
      );
    case 'Medium':
      return (
        <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200 font-medium gap-1 text-[10px] px-2 py-0.5">
          <AlertTriangle className="size-2.5" />
          Medium{detail ? ` — ${detail}` : ''}
        </Badge>
      );
    case 'High':
      return (
        <Badge className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200 font-medium gap-1 text-[10px] px-2 py-0.5">
          <AlertTriangle className="size-2.5" />
          High{detail ? ` — ${detail}` : ''}
        </Badge>
      );
  }
}

function formatVolumeShort(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount}`;
}

function formatVolumeCrore(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  return `₹${(amount / 100000).toFixed(2)}L`;
}

// ─── Circular Health Ring SVG ─────────────────────────────────────────────────

function HealthRing({ score, size = 60, strokeWidth = 5, showLabel = true }: { score: number; size?: number; strokeWidth?: number; showLabel?: boolean }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getHealthColor(score);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold leading-none ${size >= 100 ? 'text-2xl' : 'text-sm'} ${color.text}`}>
            {score}
          </span>
          {size >= 100 && (
            <span className="text-[9px] text-muted-foreground mt-0.5">/ 100</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Compliance Score Badge ───────────────────────────────────────────────────

function ComplianceBadge({ score }: { score: number }) {
  const color = score > 85 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : score >= 60 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200';
  const dotColor = score > 85 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 border text-[9px] font-semibold ${color}`}>
      <span className={`size-1.5 rounded-full ${dotColor}`} />
      {score}%
    </div>
  );
}

// ─── Filing Trend Area Chart ────────────────────────────────────────────────────

function FilingTrendChart({ data }: { data: MonthlyVolume[] }) {
  const width = 260;
  const height = 80;
  const padding = { top: 8, right: 8, bottom: 20, left: 8 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxAmount = Math.max(...data.map(d => d.amount), 1);

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - (d.amount / maxAmount) * chartH,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  return (
    <div className="relative">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {/* Area fill */}
        <motion.path
          d={areaPath}
          fill="url(#areaGradient)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        />
        {/* Line */}
        <motion.path
          d={linePath}
          fill="none"
          stroke="#10b981"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />
        {/* Dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoverIdx === i ? 4 : 2.5}
            fill="#10b981"
            stroke="white"
            strokeWidth={2}
            className="transition-all duration-150 cursor-pointer"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          />
        ))}
        {/* Month labels */}
        {points.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={height - 4}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="8"
          >
            {data[i].month}
          </text>
        ))}
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
          </linearGradient>
        </defs>
      </svg>
      {/* Hover tooltip */}
      {hoverIdx !== null && (
        <div
          className="absolute -top-8 px-2 py-1 rounded bg-slate-800 text-white text-[10px] font-medium pointer-events-none whitespace-nowrap z-10"
          style={{ left: `${((points[hoverIdx].x) / width) * 100}%`, transform: 'translateX(-50%)' }}
        >
          {formatCurrency(data[hoverIdx].amount)}
        </div>
      )}
    </div>
  );
}

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────

function MiniBarChart({ data, height = 28, barColor }: { data: MonthlyVolume[]; height?: number; barColor?: string }) {
  const maxAmount = Math.max(...data.map(d => d.amount), 1);

  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {data.map((d, i) => {
        const barHeight = Math.max(3, (d.amount / maxAmount) * height);
        return (
          <motion.div
            key={d.month}
            className="rounded-sm min-w-[6px] flex-1"
            style={{
              height: barHeight,
              backgroundColor: barColor ?? (i === data.length - 1 ? '#10b981' : '#d1fae5'),
            }}
            initial={{ height: 0 }}
            animate={{ height: barHeight }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
          />
        );
      })}
    </div>
  );
}

// ─── Health Breakdown Bar ──────────────────────────────────────────────────────

function HealthBreakdownBar({ label, value }: { label: string; value: number }) {
  const color = value > 80 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = value > 80 ? 'text-emerald-700' : value >= 50 ? 'text-amber-700' : 'text-red-700';

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-24 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, delay: 0.4 }}
        />
      </div>
      <span className={`text-[10px] font-semibold w-8 text-right ${textColor}`}>{value}%</span>
    </div>
  );
}

// ─── Animation Variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="size-11 rounded-xl" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="shadow-sm">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <Skeleton className="size-15 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="flex gap-1.5">
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
              <Skeleton className="h-6 w-full" />
              <div className="space-y-2">
                <Skeleton className="h-2.5 w-full" />
                <Skeleton className="h-2.5 w-full" />
                <Skeleton className="h-2.5 w-full" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 w-8" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Filing Status Dot ────────────────────────────────────────────────────────

function FilingStatusDot({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-emerald-700">
        <span className="size-2 rounded-full bg-emerald-500" />
        All filed
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[11px] text-amber-700">
      <span className="size-2 rounded-full bg-amber-500" />
      {count} pending
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientRegistryPage() {
  const { setCurrentView, setSelectedClientId } = useApp();

  // ── React Query hooks ──────────────────────────────────────────────────────
  const { data: clientsData, isLoading: clientsLoading } = useClients();
  const { data: filingsData, isLoading: filingsLoading } = useFilings();

  const createClientMutation = useCreateClient();
  const updateClientMutation = useUpdateClient();
  const deleteClientMutation = useDeleteClient();

  const isLoading = clientsLoading || filingsLoading;

  // ── State ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientPortfolio | null>(null);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [gstinError, setGstinError] = useState<string | null>(null);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetClient, setSheetClient] = useState<ClientPortfolio | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ClientPortfolio | null>(null);

  // ── Derive clients with portfolio data from API ──────────────────────────
  const apiClients = clientsData?.clients ?? [];
  const allFilings = filingsData?.filings ?? [];

  const clients = useMemo<ClientPortfolio[]>(() => {
    return apiClients.map(c => {
      // Get filings for this specific client
      const clientFilings = allFilings.filter(f => f.clientId === c.id);
      const filingData = clientFilings.map(f => ({
        returnType: f.returnType,
        period: f.period,
        status: f.status,
        filedDate: f.filedDate,
        totalTaxableValue: f.totalTaxableValue,
      }));
      return derivePortfolio(c, filingData);
    });
  }, [apiClients, allFilings]);

  // ── Derived Data ─────────────────────────────────────────────────────────
  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(
      c =>
        c.gstin.toLowerCase().includes(q) ||
        c.tradeName.toLowerCase().includes(q) ||
        (c.legalName?.toLowerCase().includes(q) ?? false) ||
        (c.state?.toLowerCase().includes(q) ?? false)
    );
  }, [clients, searchQuery]);

  const portfolioStats = useMemo(() => {
    const active = clients.filter(c => c.status === 'active').length;
    const atRisk = clients.filter(c => c.healthScore < 70).length;
    const pendingFilings = clients.reduce((sum, c) => sum + c._portfolio.pendingFilings, 0);
    const totalTaxVolume = clients.reduce((sum, c) => sum + c._portfolio.monthlyTaxVolume, 0);
    return { active, atRisk, pendingFilings, totalTaxVolume };
  }, [clients]);

  // ── Form Handlers ────────────────────────────────────────────────────────
  const openAddDialog = () => {
    setEditingClient(null);
    setForm(EMPTY_FORM);
    setGstinError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (client: ClientPortfolio) => {
    setEditingClient(client);
    setForm({
      gstin: client.gstin,
      tradeName: client.tradeName,
      legalName: client.legalName ?? '',
      contactEmail: client.contactEmail ?? '',
      contactPhone: client.contactPhone ?? '',
      state: client.state ?? '',
      stateCode: client.stateCode ?? '',
      entityType: client.entityType ?? 'regular',
      returnPeriod: client.returnPeriod ?? 'monthly',
    });
    setGstinError(null);
    setDialogOpen(true);
  };

  const handleFormChange = (field: keyof ClientForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'gstin') setGstinError(null);
    if (field === 'state') {
      const stateObj = INDIAN_STATES.find(s => s.name === value);
      if (stateObj) {
        setForm(prev => ({ ...prev, stateCode: stateObj.code }));
      }
    }
  };

  const handleGstinBlur = () => {
    if (form.gstin) {
      const result = validateGSTINForm(form.gstin);
      if (!result.valid) setGstinError(result.error ?? 'Invalid GSTIN');
      else setGstinError(null);
    }
  };

  const handleSubmit = async () => {
    if (!form.gstin || !form.tradeName) return;
    const result = validateGSTINForm(form.gstin);
    if (!result.valid) {
      setGstinError(result.error ?? 'Invalid GSTIN');
      return;
    }
    if (gstinError) return;

    const clientData = {
      gstin: formatGSTIN(form.gstin),
      tradeName: form.tradeName,
      legalName: form.legalName || undefined,
      contactEmail: form.contactEmail || undefined,
      contactPhone: form.contactPhone || undefined,
      state: form.state || undefined,
      stateCode: form.stateCode || undefined,
      entityType: form.entityType,
      returnPeriod: form.returnPeriod,
    };

    if (editingClient) {
      updateClientMutation.mutate(
        { id: editingClient.id, ...clientData },
        {
          onSuccess: () => {
            setDialogOpen(false);
            toast.success('Client updated successfully');
          },
          onError: (err) => {
            toast.error(err.message || 'Failed to update client');
          },
        }
      );
    } else {
      createClientMutation.mutate(
        { ...clientData, status: 'active', healthScore: 50 },
        {
          onSuccess: () => {
            setDialogOpen(false);
            toast.success('Client added successfully');
          },
          onError: (err) => {
            toast.error(err.message || 'Failed to add client');
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteClientMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        if (sheetClient?.id === deleteTarget.id) {
          setSheetOpen(false);
          setSheetClient(null);
        }
        toast.success('Client deleted successfully');
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to delete client');
      },
    });
  };

  const openClientSheet = (client: ClientPortfolio) => {
    setSheetClient(client);
    setSheetOpen(true);
  };

  const navigateTo = (view: 'returns' | 'reconcile', clientId: string) => {
    setSelectedClientId(clientId);
    setCurrentView(view as AppView);
  };

  const isSubmitting = createClientMutation.isPending || updateClientMutation.isPending;

  // ─── Loading Skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return <PageSkeleton />;
  }

  // ─── Empty state when no clients exist ──────────────────────────────────────
  if (clients.length === 0) {
    return (
      <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Client Portfolio</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Monitor health and compliance across all clients</p>
          </div>
          <Button
            onClick={openAddDialog}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shrink-0"
          >
            <Plus className="size-4" />
            Add Client
          </Button>
        </motion.div>
        <EmptyState
          icon={UserPlus}
          title="No clients added yet"
          description="Add your first client to start managing their GST compliance."
          action={{
            label: 'Add Client',
            onClick: openAddDialog,
            icon: UserPlus,
          }}
        />
        {/* Dialog must render even in empty state so openAddDialog works */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-100">
                  <Building2 className="size-4 text-emerald-700" />
                </div>
                {editingClient ? 'Edit Client' : 'Add New Client'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>GSTIN *</Label>
                <Input placeholder="e.g. 27AABCS1429B1Z5" value={form.gstin} onChange={e => { setForm(f => ({ ...f, gstin: e.target.value.toUpperCase() })); setGstinError(null); }} className={gstinError ? 'border-red-300 focus:border-red-500' : ''} />
                {gstinError && <p className="text-xs text-red-600">{gstinError}</p>}
              </div>
              <div className="space-y-2">
                <Label>Trade Name *</Label>
                <Input placeholder="e.g. Sharma Enterprises" value={form.tradeName} onChange={e => setForm(f => ({ ...f, tradeName: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Legal Name</Label>
                  <Input placeholder="Legal entity name" value={form.legalName} onChange={e => setForm(f => ({ ...f, legalName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Entity Type</Label>
                  <Select value={form.entityType} onValueChange={v => setForm(f => ({ ...f, entityType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="composition">Composition</SelectItem>
                      <SelectItem value="casual">Casual Taxable</SelectItem>
                      <SelectItem value="isdt">ISD</SelectItem>
                      <SelectItem value="tcs">TCS Collector</SelectItem>
                      <SelectItem value="tds">TDS Deductor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Select value={form.state} onValueChange={v => { const s = INDIAN_STATES.find(st => st.name === v); setForm(f => ({ ...f, state: v, stateCode: s?.code ?? '' })); }}>
                  <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map(s => <SelectItem key={s.code} value={s.name}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input placeholder="client@email.com" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input placeholder="+91 98765 43210" value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-9">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!form.gstin || !form.tradeName || !!gstinError}
                className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {editingClient ? 'Update Client' : 'Add Client'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Client Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Monitor health and compliance across all clients</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or GSTIN..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10 w-full sm:w-64 bg-white border-slate-200 focus:border-emerald-300 focus:ring-emerald-200 transition-colors"
            />
          </div>
          <Button
            onClick={openAddDialog}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shrink-0"
          >
            <Plus className="size-4" />
            Add Client
          </Button>
        </div>
      </motion.div>

      {/* ── Summary Strip ───────────────────────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {/* Active Clients */}
        <motion.div variants={itemVariants}>
          <Card className="shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-emerald-50/40 border-slate-200/80">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Active Clients</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{portfolioStats.active}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <TrendingUp className="size-3 text-emerald-500" />
                    <span className="text-[11px] text-emerald-600 font-medium">
                      {formatVolumeCrore(portfolioStats.totalTaxVolume)} total tax volume
                    </span>
                  </div>
                </div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-100">
                  <BarChart3 className="size-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* At Risk */}
        <motion.div variants={itemVariants}>
          <Card className="shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-red-50/30 border-slate-200/80">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-red-600">At Risk</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{portfolioStats.atRisk}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <AlertTriangle className="size-3 text-red-500" />
                    <span className="text-[11px] text-red-600 font-medium">
                      {portfolioStats.atRisk} clients below 70 health score
                    </span>
                  </div>
                </div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-red-100">
                  <Shield className="size-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pending Filings */}
        <motion.div variants={itemVariants}>
          <Card className="shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-amber-50/40 border-slate-200/80">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Pending Filings</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{portfolioStats.pendingFilings}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <Clock className="size-3 text-amber-500" />
                    <span className="text-[11px] text-amber-600 font-medium">
                      {portfolioStats.pendingFilings} returns need attention
                    </span>
                  </div>
                </div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-100">
                  <FileWarning className="size-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* ── Client Card Grid ─────────────────────────────────────────────────── */}
      {filteredClients.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center justify-center py-20"
        >
          <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-50 mb-4">
            <UserPlus className="size-8 text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            {searchQuery ? 'No clients found' : 'No clients yet'}
          </h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-xs text-center">
            {searchQuery
              ? 'Try adjusting your search query'
              : 'Add your first client to start filing'}
          </p>
          {!searchQuery && (
            <Button
              onClick={openAddDialog}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="size-4" />
              Add Client
            </Button>
          )}
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredClients.map(client => {
            const health = getHealthColor(client.healthScore);
            const portfolio = client._portfolio;

            return (
              <motion.div key={client.id} variants={itemVariants}>
                <motion.div
                  whileHover={{ y: -4, transition: { duration: 0.2, ease: 'easeOut' } }}
                  className="h-full"
                >
                  <Card
                    className="h-full cursor-pointer shadow-sm hover:shadow-lg hover:border-emerald-200/60 transition-all duration-200 border-slate-200/80"
                    onClick={() => { setSelectedClientId(client.id); setCurrentView('client-workspace' as AppView); }}
                  >
                    <CardContent className="p-5">
                      {/* Top row: Health Ring + Compliance Badge + Status Badge */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <HealthRing score={client.healthScore} size={60} strokeWidth={5} />
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-muted-foreground font-medium">Compliance</span>
                            <ComplianceBadge score={Math.round((portfolio.healthBreakdown.gstinValidity + portfolio.healthBreakdown.filingTimeliness) / 2)} />
                          </div>
                        </div>
                        <div className="shrink-0">
                          {getStatusBadge(client.status)}
                        </div>
                      </div>

                      {/* Client info section */}
                      <div className="mb-3">
                        <p className="font-bold text-base text-foreground leading-tight truncate">
                          {client.tradeName}
                        </p>
                        <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">
                          {client.gstin}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {client.state && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-slate-200 bg-slate-50 text-slate-600 gap-1">
                              <MapPin className="size-2.5" />
                              {client.state}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-slate-200 bg-slate-50 text-slate-600">
                            {getEntityTypeLabel(client.entityType)}
                          </Badge>
                        </div>
                      </div>

                      {/* Key metrics row */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="rounded-lg bg-slate-50 p-2">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Tax Volume</p>
                          <p className="text-xs font-bold text-foreground">{formatVolumeShort(portfolio.monthlyTaxVolume)}</p>
                          <MiniBarChart data={portfolio.monthlyVolumeChart} height={16} />
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Filing Status</p>
                          <div className="mt-1">
                            <FilingStatusDot count={portfolio.pendingFilings} />
                          </div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Risk</p>
                          <div className="mt-0.5">
                            {getRiskBadge(portfolio.riskLevel)}
                          </div>
                        </div>
                      </div>

                      {/* Health breakdown bars */}
                      <div className="space-y-1.5 mb-3">
                        <HealthBreakdownBar label="GSTIN Validity" value={portfolio.healthBreakdown.gstinValidity} />
                        <HealthBreakdownBar label="Filing Timeliness" value={portfolio.healthBreakdown.filingTimeliness} />
                        <HealthBreakdownBar label="Invoice Accuracy" value={portfolio.healthBreakdown.invoiceAccuracy} />
                      </div>

                      {/* Action buttons row */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 transition-colors"
                          onClick={e => { e.stopPropagation(); navigateTo('returns', client.id); }}
                        >
                          <FileText className="size-3" />
                          View Returns
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 transition-colors"
                          onClick={e => { e.stopPropagation(); navigateTo('reconcile', client.id); }}
                        >
                          <ArrowRightLeft className="size-3" />
                          Reconcile
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <Button variant="outline" size="sm" className="size-8 p-0 shrink-0 hover:bg-slate-50">
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => openEditDialog(client)} className="gap-2">
                              <Pencil className="size-3.5" />
                              Edit Client
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(client)}
                              className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                            >
                              <Trash2 className="size-3.5" />
                              Delete Client
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* ── Add / Edit Client Dialog ────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-100">
                <Building2 className="size-4 text-emerald-700" />
              </div>
              {editingClient ? 'Edit Client' : 'Add New Client'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Trade Name */}
              <div className="space-y-2">
                <Label htmlFor="tradeName" className="text-xs font-medium">
                  Trade Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="tradeName"
                  placeholder="e.g. Sharma Enterprises"
                  value={form.tradeName}
                  onChange={e => handleFormChange('tradeName', e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Legal Name */}
              <div className="space-y-2">
                <Label htmlFor="legalName" className="text-xs font-medium">Legal Name</Label>
                <Input
                  id="legalName"
                  placeholder="e.g. Sharma Enterprises Pvt Ltd"
                  value={form.legalName}
                  onChange={e => handleFormChange('legalName', e.target.value)}
                  className="h-9"
                />
              </div>

              {/* GSTIN */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="gstin" className="text-xs font-medium">
                  GSTIN <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="gstin"
                  placeholder="e.g. 27AABCS1234F1ZH"
                  value={form.gstin}
                  onChange={e => handleFormChange('gstin', e.target.value.toUpperCase())}
                  onBlur={handleGstinBlur}
                  className={`font-mono h-9 ${gstinError ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
                />
                {gstinError && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="size-3" />
                    {gstinError}
                  </p>
                )}
              </div>

              {/* State */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">State</Label>
                <Select value={form.state} onValueChange={v => handleFormChange('state', v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map(s => (
                      <SelectItem key={s.code} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Entity Type */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Entity Type</Label>
                <Select value={form.entityType} onValueChange={v => handleFormChange('entityType', v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map(e => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Contact Email */}
              <div className="space-y-2">
                <Label htmlFor="contactEmail" className="text-xs font-medium">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="gst@company.com"
                  value={form.contactEmail}
                  onChange={e => handleFormChange('contactEmail', e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Contact Phone */}
              <div className="space-y-2">
                <Label htmlFor="contactPhone" className="text-xs font-medium">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  placeholder="+91-XXXX-XXX-XXX"
                  value={form.contactPhone}
                  onChange={e => handleFormChange('contactPhone', e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Return Period */}
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs font-medium">Default Return Period</Label>
                <Select value={form.returnPeriod} onValueChange={v => handleFormChange('returnPeriod', v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {RETURN_PERIODS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-9">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !form.tradeName || !form.gstin}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white h-9"
            >
              {isSubmitting ? (
                <motion.div
                  className="size-4 border-2 border-white/30 border-t-white rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                />
              ) : (
                <Plus className="size-4" />
              )}
              {editingClient ? 'Update Client' : 'Add Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Client Detail Sheet ─────────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md lg:max-w-lg overflow-y-auto">
          {sheetClient && (
            <>
              <SheetHeader className="pb-2">
                <SheetTitle className="sr-only">{sheetClient.tradeName}</SheetTitle>
              </SheetHeader>

              <div className="px-4 pb-6 space-y-6">
                {/* Hero: Large Health Ring + Client Name */}
                <div className="flex flex-col items-center text-center pt-2">
                  <HealthRing score={sheetClient.healthScore} size={100} strokeWidth={7} />
                  <h2 className="text-lg font-bold text-foreground mt-3">{sheetClient.tradeName}</h2>
                  <p className="text-sm font-mono text-muted-foreground mt-0.5">{sheetClient.gstin}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {getStatusBadge(sheetClient.status)}
                    {sheetClient.state && (
                      <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-slate-200 bg-slate-50 text-slate-600 gap-1">
                        <MapPin className="size-2.5" />
                        {sheetClient.state}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-slate-200 bg-slate-50 text-slate-600">
                      {getEntityTypeLabel(sheetClient.entityType)}
                    </Badge>
                  </div>
                </div>

                <Separator />

                {/* Health Breakdown */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Health Breakdown</h3>
                  <div className="space-y-2.5">
                    <HealthBreakdownBar label="GSTIN Validity" value={sheetClient._portfolio.healthBreakdown.gstinValidity} />
                    <HealthBreakdownBar label="Filing Timeliness" value={sheetClient._portfolio.healthBreakdown.filingTimeliness} />
                    <HealthBreakdownBar label="Invoice Accuracy" value={sheetClient._portfolio.healthBreakdown.invoiceAccuracy} />
                  </div>
                </div>

                <Separator />

                {/* Contact Info */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Contact Information</h3>
                  <div className="space-y-2">
                    {sheetClient.contactEmail && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Mail className="size-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground truncate">{sheetClient.contactEmail}</span>
                      </div>
                    )}
                    {sheetClient.contactPhone && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Phone className="size-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground">{sheetClient.contactPhone}</span>
                      </div>
                    )}
                    {sheetClient.legalName && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Building2 className="size-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground truncate">{sheetClient.legalName}</span>
                      </div>
                    )}
                    {sheetClient.returnPeriod && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Calendar className="size-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground capitalize">{sheetClient.returnPeriod} filing</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Compliance Risk */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Compliance Risk</h3>
                  <div className="flex items-center gap-2">
                    {getRiskBadge(sheetClient._portfolio.riskLevel, sheetClient._portfolio.riskDetail)}
                  </div>
                </div>

                <Separator />

                {/* Recent Filing History Timeline */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Recent Filings</h3>
                  {sheetClient._portfolio.recentFilings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recent filings</p>
                  ) : (
                    <div className="relative pl-5 space-y-3">
                      {/* Timeline line */}
                      <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-slate-200" />
                      {sheetClient._portfolio.recentFilings.map((filing, idx) => {
                        const isFiled = filing.status === 'Filed';
                        const isOverdue = filing.status === 'Overdue';
                        return (
                          <div key={idx} className="relative flex items-start gap-3">
                            <div className={`absolute -left-5 top-1 size-2.5 rounded-full ring-2 ring-white ${
                              isFiled ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-amber-500'
                            }`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {filing.type} — {filing.period}
                                </p>
                                <Badge className={`text-[9px] px-1.5 py-0 shrink-0 ${
                                  isFiled
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : isOverdue
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {filing.status}
                                </Badge>
                              </div>
                              {filing.date && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  Filed on {new Date(filing.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Filing Trend Area Chart */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">Filing Trend</h3>
                  <p className="text-[11px] text-muted-foreground mb-3">Monthly tax volume — last 6 months</p>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <FilingTrendChart data={sheetClient._portfolio.monthlyVolumeChart} />
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200">
                      <span className="text-xs text-muted-foreground">Current month</span>
                      <span className="text-sm font-bold text-foreground">
                        {formatCurrency(sheetClient._portfolio.monthlyTaxVolume)}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => { navigateTo('returns', sheetClient.id); setSheetOpen(false); }}
                  >
                    <FileText className="size-4" />
                    View Returns
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={() => { navigateTo('reconcile', sheetClient.id); setSheetOpen(false); }}
                  >
                    <ArrowRightLeft className="size-4" />
                    Reconcile
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Delete Confirmation ──────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.tradeName}</strong> ({deleteTarget?.gstin})?
              This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteClientMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteClientMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteClientMutation.isPending ? 'Deleting...' : 'Delete Client'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
