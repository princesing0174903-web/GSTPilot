'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  Loader2,
  GitCompareArrows,
  FileSpreadsheet,
  Search,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Eye,
  ArrowRight,
  ChevronRight,
  Clock,
  History,
  FileText,
  Copy,
  AlertCircle,
  CircleDot,
  MinusCircle,
} from 'lucide-react';
import { formatCurrency, generateMismatchExplanation } from '@/lib/gst-utils';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';
import type {
  ReconciliationResult,
  ReconciliationRun,
  Client,
  MatchStatus,
} from '@/types/gst';
import { MATCH_STATUS_CONFIG } from '@/types/gst';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface ClientOption {
  id: string;
  tradeName: string;
  gstin: string;
}

interface MismatchDetail {
  field: string;
  expected: string | number;
  actual: string | number;
  difference?: number;
}

interface MismatchRecord {
  id: string;
  invoiceNumber: string;
  clientName: string;
  mismatchCategory: string;
  mismatchType: string;
  taxDifference: number;
  confidenceScore: number;
  aiExplanation: string;
  aiRecommendation: string;
  booksData: {
    invoiceNumber: string;
    invoiceDate: string;
    sellerGstin: string;
    buyerGstin: string;
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalAmount: number;
  };
  gstr2bData: {
    invoiceNumber: string;
    invoiceDate: string;
    sellerGstin: string;
    buyerGstin: string;
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalAmount: number;
  } | null;
  diffFields: string[];
  resolved: boolean;
  workflowStatus: string;
}

interface ReconTimelineEntry {
  id: string;
  date: string;
  clients: string;
  recordsProcessed: number;
  matchRate: number;
}

// ──────────────────────────────────────────────
// Mock Data — the 6 CRITICAL mismatches from spec
// ──────────────────────────────────────────────
const MOCK_CLIENTS: ClientOption[] = [
  { id: 'cl-1', tradeName: 'Sharma Enterprises', gstin: '27AABCS1429B1Z5' },
  { id: 'cl-2', tradeName: 'Patel & Sons', gstin: '24AABCP1234B1Z3' },
  { id: 'cl-3', tradeName: 'Krishna Traders', gstin: '27AABCK5678B1Z1' },
  { id: 'cl-4', tradeName: 'Metro Retail', gstin: '36AABCM9012B1Z9' },
  { id: 'cl-5', tradeName: 'Sunrise Exports', gstin: '27AABCS3456B1Z7' },
  { id: 'cl-6', tradeName: 'Gupta Manufacturing', gstin: '09AABCG7890B1Z3' },
];

const MOCK_MISMATCHES: MismatchRecord[] = [
  {
    id: 'mm-1',
    invoiceNumber: 'INV-2025-0045',
    clientName: 'Sharma Enterprises',
    mismatchCategory: 'tax_difference',
    mismatchType: 'Tax Amount Difference',
    taxDifference: 1240,
    confidenceScore: 94,
    aiExplanation: 'CGST ₹620 less in GSTR-2B',
    aiRecommendation: 'Accept GSTR-2B value — the vendor likely reported a lower CGST amount. The difference of ₹620 per component (₹1,240 total) suggests a rate revision.',
    booksData: {
      invoiceNumber: 'INV-2025-0045',
      invoiceDate: '2025-02-15',
      sellerGstin: '27AABCS1429B1Z5',
      buyerGstin: '27AABCB9876B1Z1',
      taxableValue: 50000,
      cgst: 4500,
      sgst: 4500,
      igst: 0,
      totalAmount: 59000,
    },
    gstr2bData: {
      invoiceNumber: 'INV-2025-0045',
      invoiceDate: '2025-02-15',
      sellerGstin: '27AABCS1429B1Z5',
      buyerGstin: '27AABCB9876B1Z1',
      taxableValue: 50000,
      cgst: 3880,
      sgst: 4500,
      igst: 0,
      totalAmount: 58380,
    },
    diffFields: ['cgst', 'totalAmount'],
    resolved: false,
    workflowStatus: 'pending',
  },
  {
    id: 'mm-2',
    invoiceNumber: 'INV-2025-0078',
    clientName: 'Patel & Sons',
    mismatchCategory: 'gstin_mismatch',
    mismatchType: 'GSTIN Mismatch',
    taxDifference: 0,
    confidenceScore: 87,
    aiExplanation: 'Seller GSTIN differs by 1 character',
    aiRecommendation: 'Correct GSTIN — the seller GSTIN in books ends with "Z3" while GSTR-2B shows "Z4". This is likely a data entry error in your purchase register.',
    booksData: {
      invoiceNumber: 'INV-2025-0078',
      invoiceDate: '2025-02-18',
      sellerGstin: '24AABCP1234B1Z3',
      buyerGstin: '24AABCB5678B1Z2',
      taxableValue: 75000,
      cgst: 6750,
      sgst: 6750,
      igst: 0,
      totalAmount: 88500,
    },
    gstr2bData: {
      invoiceNumber: 'INV-2025-0078',
      invoiceDate: '2025-02-18',
      sellerGstin: '24AABCP1234B1Z4',
      buyerGstin: '24AABCB5678B1Z2',
      taxableValue: 75000,
      cgst: 6750,
      sgst: 6750,
      igst: 0,
      totalAmount: 88500,
    },
    diffFields: ['sellerGstin'],
    resolved: false,
    workflowStatus: 'pending',
  },
  {
    id: 'mm-3',
    invoiceNumber: 'INV-2025-0112',
    clientName: 'Krishna Traders',
    mismatchCategory: 'missing_in_gstr',
    mismatchType: 'Invoice Not in GSTR-2B',
    taxDifference: 5400,
    confidenceScore: 91,
    aiExplanation: 'Found in books but missing from portal',
    aiRecommendation: 'Contact vendor immediately — this invoice is not reflected in GSTR-2B. ITC of ₹5,400 is at risk if the vendor does not upload before the deadline.',
    booksData: {
      invoiceNumber: 'INV-2025-0112',
      invoiceDate: '2025-02-22',
      sellerGstin: '27AABCK5678B1Z1',
      buyerGstin: '27AABCB9876B1Z1',
      taxableValue: 30000,
      cgst: 2700,
      sgst: 2700,
      igst: 0,
      totalAmount: 35400,
    },
    gstr2bData: null,
    diffFields: ['sellerGstin', 'taxableValue', 'cgst', 'sgst', 'igst', 'totalAmount'],
    resolved: false,
    workflowStatus: 'pending',
  },
  {
    id: 'mm-4',
    invoiceNumber: 'INV-2025-0203',
    clientName: 'Metro Retail',
    mismatchCategory: 'duplicate',
    mismatchType: 'Duplicate Detected',
    taxDifference: 0,
    confidenceScore: 96,
    aiExplanation: 'Same invoice number appears twice',
    aiRecommendation: 'Mark as duplicate — the same invoice number INV-2025-0203 from this GSTIN appears twice in your purchase register. Remove the duplicate entry to avoid double ITC claim.',
    booksData: {
      invoiceNumber: 'INV-2025-0203',
      invoiceDate: '2025-02-25',
      sellerGstin: '36AABCM9012B1Z9',
      buyerGstin: '36AABCB3456B1Z5',
      taxableValue: 45000,
      cgst: 4050,
      sgst: 4050,
      igst: 0,
      totalAmount: 53100,
    },
    gstr2bData: {
      invoiceNumber: 'INV-2025-0203',
      invoiceDate: '2025-02-25',
      sellerGstin: '36AABCM9012B1Z9',
      buyerGstin: '36AABCB3456B1Z5',
      taxableValue: 45000,
      cgst: 4050,
      sgst: 4050,
      igst: 0,
      totalAmount: 53100,
    },
    diffFields: [],
    resolved: false,
    workflowStatus: 'pending',
  },
  {
    id: 'mm-5',
    invoiceNumber: 'INV-2025-0287',
    clientName: 'Sunrise Exports',
    mismatchCategory: 'tax_difference',
    mismatchType: 'Tax Amount Difference',
    taxDifference: 3450,
    confidenceScore: 89,
    aiExplanation: 'IGST ₹3,450 more in books',
    aiRecommendation: 'Verify with shipping documents — books show IGST of ₹11,500 but GSTR-2B reflects only ₹8,050. This could be an export invoice with incorrect tax treatment.',
    booksData: {
      invoiceNumber: 'INV-2025-0287',
      invoiceDate: '2025-03-01',
      sellerGstin: '27AABCS3456B1Z7',
      buyerGstin: '',
      taxableValue: 65000,
      cgst: 0,
      sgst: 0,
      igst: 11500,
      totalAmount: 76500,
    },
    gstr2bData: {
      invoiceNumber: 'INV-2025-0287',
      invoiceDate: '2025-03-01',
      sellerGstin: '27AABCS3456B1Z7',
      buyerGstin: '',
      taxableValue: 65000,
      cgst: 0,
      sgst: 0,
      igst: 8050,
      totalAmount: 73050,
    },
    diffFields: ['igst', 'totalAmount'],
    resolved: false,
    workflowStatus: 'pending',
  },
  {
    id: 'mm-6',
    invoiceNumber: 'INV-2025-0341',
    clientName: 'Gupta Manufacturing',
    mismatchCategory: 'missing_in_books',
    mismatchType: 'Invoice Not in Books',
    taxDifference: 3600,
    confidenceScore: 93,
    aiExplanation: 'Present in GSTR-2B but not in purchase register',
    aiRecommendation: 'Add to purchase register — this invoice from GSTR-2B is not in your books. If legitimate, add it to claim the eligible ITC of ₹3,600.',
    booksData: {
      invoiceNumber: '—',
      invoiceDate: '—',
      sellerGstin: '—',
      buyerGstin: '—',
      taxableValue: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalAmount: 0,
    },
    gstr2bData: {
      invoiceNumber: 'INV-2025-0341',
      invoiceDate: '2025-03-05',
      sellerGstin: '09AABCG7890B1Z3',
      buyerGstin: '09AABCB1234B1Z1',
      taxableValue: 20000,
      cgst: 1800,
      sgst: 1800,
      igst: 0,
      totalAmount: 23600,
    },
    diffFields: ['invoiceNumber', 'invoiceDate', 'sellerGstin', 'buyerGstin', 'taxableValue', 'cgst', 'sgst', 'igst', 'totalAmount'],
    resolved: false,
    workflowStatus: 'pending',
  },
];

const MOCK_PERFECT_MATCHES = 18;
const MOCK_PARTIAL_MATCHES = 3;

const MOCK_TIMELINE: ReconTimelineEntry[] = [
  {
    id: 'run-1',
    date: '2025-03-04T14:32:00Z',
    clients: 'All Clients',
    recordsProcessed: 27,
    matchRate: 67,
  },
  {
    id: 'run-2',
    date: '2025-03-01T09:15:00Z',
    clients: 'Sharma Enterprises, Patel & Sons',
    recordsProcessed: 14,
    matchRate: 71,
  },
  {
    id: 'run-3',
    date: '2025-02-25T11:48:00Z',
    clients: 'All Clients',
    recordsProcessed: 27,
    matchRate: 74,
  },
  {
    id: 'run-4',
    date: '2025-02-20T16:22:00Z',
    clients: 'Krishna Traders',
    recordsProcessed: 5,
    matchRate: 80,
  },
  {
    id: 'run-5',
    date: '2025-02-15T10:05:00Z',
    clients: 'Metro Retail, Sunrise Exports',
    recordsProcessed: 11,
    matchRate: 73,
  },
];

// ──────────────────────────────────────────────
// Mismatch Category Config
// ──────────────────────────────────────────────
type MismatchCategory = 'all' | 'tax_difference' | 'gstin_mismatch' | 'missing_in_gstr' | 'missing_in_books' | 'duplicate';

interface MismatchCategoryConfig {
  key: MismatchCategory;
  label: string;
  icon: React.ReactNode;
  color: string;
  activeBorder: string;
  bgColor: string;
}

const MISMATCH_CATEGORIES: MismatchCategoryConfig[] = [
  {
    key: 'tax_difference',
    label: 'Tax Amount Difference',
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    color: 'text-amber-700',
    activeBorder: 'border-emerald-500',
    bgColor: 'bg-amber-50',
  },
  {
    key: 'gstin_mismatch',
    label: 'GSTIN Mismatch',
    icon: <ShieldAlert className="h-3.5 w-3.5" />,
    color: 'text-orange-700',
    activeBorder: 'border-emerald-500',
    bgColor: 'bg-orange-50',
  },
  {
    key: 'missing_in_gstr',
    label: 'Invoice Not in GSTR-2B',
    icon: <FileText className="h-3.5 w-3.5" />,
    color: 'text-rose-700',
    activeBorder: 'border-emerald-500',
    bgColor: 'bg-rose-50',
  },
  {
    key: 'missing_in_books',
    label: 'Invoice Not in Books',
    icon: <Copy className="h-3.5 w-3.5" />,
    color: 'text-violet-700',
    activeBorder: 'border-emerald-500',
    bgColor: 'bg-violet-50',
  },
  {
    key: 'duplicate',
    label: 'Duplicate Detected',
    icon: <Copy className="h-3.5 w-3.5" />,
    color: 'text-pink-700',
    activeBorder: 'border-emerald-500',
    bgColor: 'bg-pink-50',
  },
];

// ──────────────────────────────────────────────
// Mismatch type badge styling
// ──────────────────────────────────────────────
function getMismatchBadgeClasses(category: string): string {
  switch (category) {
    case 'tax_difference':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'gstin_mismatch':
      return 'bg-orange-50 text-orange-800 border-orange-200';
    case 'missing_in_gstr':
      return 'bg-rose-50 text-rose-800 border-rose-200';
    case 'missing_in_books':
      return 'bg-violet-50 text-violet-800 border-violet-200';
    case 'duplicate':
      return 'bg-pink-50 text-pink-800 border-pink-200';
    default:
      return 'bg-slate-50 text-slate-800 border-slate-200';
  }
}

function getMismatchDotColor(category: string): string {
  switch (category) {
    case 'tax_difference': return 'bg-amber-500';
    case 'gstin_mismatch': return 'bg-orange-500';
    case 'missing_in_gstr': return 'bg-rose-500';
    case 'missing_in_books': return 'bg-violet-500';
    case 'duplicate': return 'bg-pink-500';
    default: return 'bg-slate-500';
  }
}

// ──────────────────────────────────────────────
// Animated SVG Ring for Match Rate
// ──────────────────────────────────────────────
function MatchRateRing({
  matchPercent,
  partialPercent,
  mismatchPercent,
  size = 160,
  strokeWidth = 14,
}: {
  matchPercent: number;
  partialPercent: number;
  mismatchPercent: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gapAngle = 2; // degrees gap between segments

  const matchArc = (matchPercent / 100) * circumference;
  const partialArc = (partialPercent / 100) * circumference;
  const mismatchArc = (mismatchPercent / 100) * circumference;

  // Calculate stroke-dasharray and stroke-dashoffset for each segment
  // We rotate the SVG so it starts at the top
  const totalGap = gapAngle * 3 * (circumference / 360);
  const availableCircumference = circumference - totalGap;
  const gapLen = totalGap / 3;

  const matchLen = (matchPercent / 100) * availableCircumference;
  const partialLen = (partialPercent / 100) * availableCircumference;
  const mismatchLen = (mismatchPercent / 100) * availableCircumference;

  const matchOffset = 0;
  const partialOffset = -(matchLen + gapLen);
  const mismatchOffset = -(matchLen + gapLen + partialLen + gapLen);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
        />
        {/* Glow filter */}
        <defs>
          <filter id="ringGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Green segment — matched */}
        {matchPercent > 0 && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#10b981"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${matchLen} ${circumference - matchLen}`}
            strokeDashoffset={matchOffset}
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${matchLen} ${circumference - matchLen}` }}
            transition={{ duration: 1.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            filter="url(#ringGlow)"
          />
        )}
        {/* Amber segment — partial */}
        {partialPercent > 0 && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${partialLen} ${circumference - partialLen}`}
            strokeDashoffset={partialOffset}
            initial={{ strokeDasharray: `0 ${circumference}`, strokeDashoffset: 0 }}
            animate={{ strokeDasharray: `${partialLen} ${circumference - partialLen}`, strokeDashoffset: partialOffset }}
            transition={{ duration: 1.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
            filter="url(#ringGlow)"
          />
        )}
        {/* Red segment — mismatch/missing */}
        {mismatchPercent > 0 && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#ef4444"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${mismatchLen} ${circumference - mismatchLen}`}
            strokeDashoffset={mismatchOffset}
            initial={{ strokeDasharray: `0 ${circumference}`, strokeDashoffset: 0 }}
            animate={{ strokeDasharray: `${mismatchLen} ${circumference - mismatchLen}`, strokeDashoffset: mismatchOffset }}
            transition={{ duration: 1.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.6 }}
            filter="url(#ringGlow)"
          />
        )}
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-4xl font-bold tracking-tight text-foreground"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.5, type: 'spring' }}
        >
          {matchPercent}%
        </motion.span>
        <span className="text-[11px] font-medium text-muted-foreground mt-0.5">Match Rate</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Animation variants
// ──────────────────────────────────────────────
const pageVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const cardEntrance = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: 'easeOut' } },
};

const slideInRight = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

// ──────────────────────────────────────────────
// Comparison Field Row
// ──────────────────────────────────────────────
function ComparisonField({
  label,
  booksValue,
  gstr2bValue,
  isDiff = false,
}: {
  label: string;
  booksValue: string | number;
  gstr2bValue: string | number;
  isDiff?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr] gap-0">
      <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border/40">
        {label}
      </div>
      <div className={`px-3 py-2 text-xs border-b border-border/40 ${isDiff ? 'bg-emerald-50/70 font-semibold text-emerald-900' : 'text-foreground'}`}>
        {booksValue || '—'}
      </div>
      <div className={`px-3 py-2 text-xs border-b border-border/40 ${isDiff ? 'bg-amber-50/70 font-semibold text-amber-900' : 'text-foreground'}`}>
        {gstr2bValue || '—'}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
export default function ReconciliationPage() {
  const { selectedClientId, setCurrentView } = useApp();

  // ── Data ──
  const [mismatches, setMismatches] = useState<MismatchRecord[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [timeline, setTimeline] = useState<ReconTimelineEntry[]>([]);

  // ── Computed stats ──
  const [perfectMatchCount, setPerfectMatchCount] = useState(0);
  const [partialMatchCount, setPartialMatchCount] = useState(0);

  // ── Loading ──
  const [loading, setLoading] = useState(true);
  const [runningRecon, setRunningRecon] = useState(false);

  // ── Filters ──
  const [filterClient, setFilterClient] = useState<string>('all');
  const [activeCategory, setActiveCategory] = useState<MismatchCategory>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  // ── Selection ──
  const [selectedMismatchId, setSelectedMismatchId] = useState<string | null>(null);

  // ── Sidebar ──
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);

  // ──────────────────────────────────────────
  // Data Fetching
  // ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedClientId) params.set('clientId', selectedClientId);

      const [reconRes, clientsRes] = await Promise.all([
        fetch(`/api/reconciliation?${params.toString()}`),
        fetch('/api/clients'),
      ]);

      let fetchedResults: MismatchRecord[] = [];
      let fetchedPerfect = 0;
      let fetchedPartial = 0;
      let fetchedClients: ClientOption[] = [];
      let fetchedTimeline: ReconTimelineEntry[] = [];

      if (reconRes.ok) {
        const data = await reconRes.json();
        // Transform API results into our MismatchRecord format
        const results = data.results || [];
        const nonPerfect = results.filter(
          (r: ReconciliationResult) => r.matchStatus !== 'perfect_match'
        );
        fetchedPerfect = results.filter(
          (r: ReconciliationResult) => r.matchStatus === 'perfect_match'
        ).length;
        fetchedPartial = results.filter(
          (r: ReconciliationResult) => r.matchStatus === 'partial_match'
        ).length;

        fetchedResults = nonPerfect.map((r: ReconciliationResult) => {
          let parsedMismatches: MismatchDetail[] = [];
          if (r.mismatches) {
            try { parsedMismatches = JSON.parse(r.mismatches); } catch { /* noop */ }
          }

          const category = mapStatusToCategory(r.matchStatus, parsedMismatches);
          const inv = r.invoice;

          return {
            id: r.id,
            invoiceNumber: inv?.invoiceNumber || '—',
            clientName: inv?.client?.tradeName || 'Unknown',
            mismatchCategory: category,
            mismatchType: MATCH_STATUS_CONFIG[r.matchStatus as MatchStatus]?.label || 'Unknown',
            taxDifference: calculateTaxDiff(parsedMismatches),
            confidenceScore: r.confidenceScore || 0,
            aiExplanation: r.aiExplanation || '',
            aiRecommendation: r.aiRecommendation || '',
            booksData: {
              invoiceNumber: inv?.invoiceNumber || '—',
              invoiceDate: inv?.invoiceDate || '—',
              sellerGstin: inv?.sellerGstin || '—',
              buyerGstin: inv?.buyerGstin || '—',
              taxableValue: inv?.taxableValue || 0,
              cgst: inv?.cgst || 0,
              sgst: inv?.sgst || 0,
              igst: inv?.igst || 0,
              totalAmount: inv?.totalAmount || 0,
            },
            gstr2bData: r.matchStatus === 'missing_in_gstr' ? null : {
              invoiceNumber: inv?.invoiceNumber || '—',
              invoiceDate: inv?.invoiceDate || '—',
              sellerGstin: r.matchedGstin || inv?.sellerGstin || '—',
              buyerGstin: inv?.buyerGstin || '—',
              taxableValue: inv?.taxableValue || 0,
              cgst: inv?.cgst || 0,
              sgst: inv?.sgst || 0,
              igst: inv?.igst || 0,
              totalAmount: inv?.totalAmount || 0,
            },
            diffFields: parsedMismatches.map(m => m.field),
            resolved: r.resolved || false,
            workflowStatus: r.workflowStatus || 'pending',
          } as MismatchRecord;
        });
      }

      if (clientsRes.ok) {
        const data = await clientsRes.json();
        fetchedClients = (data.clients || []).map((c: Client) => ({
          id: c.id,
          tradeName: c.tradeName,
          gstin: c.gstin,
        }));
      }

      // Fetch runs for timeline
      try {
        const runsRes = await fetch(`/api/reconciliation?action=runs&${params.toString()}`);
        if (runsRes.ok) {
          const runsData = await runsRes.json();
          fetchedTimeline = (runsData.runs || []).map((run: ReconciliationRun) => ({
            id: run.id,
            date: run.createdAt,
            clients: run.clientId,
            recordsProcessed: run.totalRecords,
            matchRate: run.totalRecords > 0 ? Math.round((run.matched / run.totalRecords) * 100) : 0,
          }));
        }
      } catch { /* timeline is non-critical */ }

      // Use fetched data if available, otherwise use mocks
      if (fetchedResults.length > 0) {
        setMismatches(fetchedResults);
        setPerfectMatchCount(fetchedPerfect);
        setPartialMatchCount(fetchedPartial);
      } else {
        setMismatches(MOCK_MISMATCHES);
        setPerfectMatchCount(MOCK_PERFECT_MATCHES);
        setPartialMatchCount(MOCK_PARTIAL_MATCHES);
      }

      if (fetchedClients.length > 0) {
        setClients(fetchedClients);
      } else {
        setClients(MOCK_CLIENTS);
      }

      if (fetchedTimeline.length > 0) {
        setTimeline(fetchedTimeline);
      } else {
        setTimeline(MOCK_TIMELINE);
      }
    } catch (err) {
      console.error('Error fetching reconciliation data:', err);
      // Fallback to mocks
      setMismatches(MOCK_MISMATCHES);
      setPerfectMatchCount(MOCK_PERFECT_MATCHES);
      setPartialMatchCount(MOCK_PARTIAL_MATCHES);
      setClients(MOCK_CLIENTS);
      setTimeline(MOCK_TIMELINE);
    } finally {
      setLoading(false);
    }
  }, [selectedClientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ──────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────
  function mapStatusToCategory(status: string, parsedMismatches: MismatchDetail[]): string {
    if (status === 'missing_in_gstr') return 'missing_in_gstr';
    if (status === 'missing_in_books') return 'missing_in_books';
    if (status === 'duplicate') return 'duplicate';
    if (parsedMismatches.some(m => m.field === 'vendor_gstin')) return 'gstin_mismatch';
    if (parsedMismatches.some(m => m.field === 'gst_amount' || m.field === 'total_amount')) return 'tax_difference';
    return 'tax_difference'; // default for partial/mismatch
  }

  function calculateTaxDiff(parsedMismatches: MismatchDetail[]): number {
    const gstMismatch = parsedMismatches.find(m => m.field === 'gst_amount');
    if (gstMismatch?.difference) return Math.abs(gstMismatch.difference);
    return 0;
  }

  // ──────────────────────────────────────────
  // Computed Values
  // ──────────────────────────────────────────
  // ── Severity helpers ──
  function getMismatchSeverity(m: MismatchRecord): 'critical' | 'high' | 'medium' | 'low' {
    if (m.mismatchCategory === 'missing_in_gstr' && m.taxDifference > 3000) return 'critical';
    if (m.taxDifference > 3000) return 'critical';
    if (m.mismatchCategory === 'gstin_mismatch') return 'high';
    if (m.taxDifference > 1000) return 'high';
    if (m.mismatchCategory === 'duplicate') return 'medium';
    if (m.taxDifference <= 1000 && m.taxDifference > 0) return 'medium';
    return 'low';
  }

  function getSeverityConfig(severity: string): { color: string; bgColor: string; dotClass: string; label: string } {
    switch (severity) {
      case 'critical': return { color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', dotClass: 'bg-red-500', label: 'Critical' };
      case 'high': return { color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200', dotClass: 'bg-orange-500', label: 'High' };
      case 'medium': return { color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', dotClass: 'bg-amber-500', label: 'Medium' };
      case 'low': return { color: 'text-slate-600', bgColor: 'bg-slate-50 border-slate-200', dotClass: 'bg-slate-400', label: 'Low' };
      default: return { color: 'text-slate-600', bgColor: 'bg-slate-50 border-slate-200', dotClass: 'bg-slate-400', label: 'Low' };
    }
  }

  const filteredMismatches = useMemo(() => {
    let filtered = mismatches;
    if (filterClient !== 'all') {
      filtered = filtered.filter(m =>
        clients.find(c => c.id === filterClient)?.tradeName === m.clientName
      );
    }
    if (activeCategory !== 'all') {
      filtered = filtered.filter(m => m.mismatchCategory === activeCategory);
    }
    if (filterSeverity !== 'all') {
      filtered = filtered.filter(m => getMismatchSeverity(m) === filterSeverity);
    }
    return filtered;
  }, [mismatches, filterClient, activeCategory, clients, filterSeverity]);

  const selectedMismatch = useMemo(
    () => mismatches.find(m => m.id === selectedMismatchId) || null,
    [mismatches, selectedMismatchId]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      tax_difference: 0,
      gstin_mismatch: 0,
      missing_in_gstr: 0,
      missing_in_books: 0,
      duplicate: 0,
    };
    mismatches.forEach(m => {
      if (counts[m.mismatchCategory] !== undefined) {
        counts[m.mismatchCategory]++;
      }
    });
    return counts;
  }, [mismatches]);

  const totalRecords = perfectMatchCount + partialMatchCount + mismatches.length;
  const totalGstDifference = mismatches.reduce((sum, m) => sum + m.taxDifference, 0);

  const matchPercent = totalRecords > 0 ? Math.round((perfectMatchCount / totalRecords) * 100) : 0;
  const partialPercent = totalRecords > 0 ? Math.round((partialMatchCount / totalRecords) * 100) : 0;
  const mismatchPercent = totalRecords > 0 ? 100 - matchPercent - partialPercent : 0;

  const isEmpty = totalRecords === 0;

  // ──────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────
  const handleRunReconciliation = async () => {
    setRunningRecon(true);
    try {
      const clientId = selectedClientId || (filterClient !== 'all' ? filterClient : null);
      if (!clientId) {
        toast.error('Select a client first to run reconciliation');
        setRunningRecon(false);
        return;
      }
      const res = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run',
          clientId,
          period: '2025-03',
          sources: 'Purchase Register,GSTR-2B',
        }),
      });
      if (res.ok) {
        toast.success('Reconciliation completed successfully');
        await fetchData();
      } else {
        toast.error('Reconciliation failed');
      }
    } catch {
      toast.error('Error running reconciliation');
    } finally {
      setRunningRecon(false);
    }
  };

  const handleAcceptGSTR2B = (id: string) => {
    setMismatches(prev =>
      prev.map(m => m.id === id ? { ...m, resolved: true, workflowStatus: 'resolved' } : m)
    );
    toast.success('Accepted GSTR-2B value — mismatch resolved');
  };

  const handleKeepBooks = (id: string) => {
    setMismatches(prev =>
      prev.map(m => m.id === id ? { ...m, resolved: true, workflowStatus: 'resolved' } : m)
    );
    toast.success('Kept books value — mismatch resolved');
  };

  const handleCustomResolution = (id: string) => {
    setMismatches(prev =>
      prev.map(m => m.id === id ? { ...m, workflowStatus: 'under_review' } : m)
    );
    toast.info('Marked for custom resolution — under review');
  };

  const handleAutoResolve = () => {
    const toResolve = mismatches.filter(m => !m.resolved && m.confidenceScore >= 93);
    const ids = new Set(toResolve.map(m => m.id));
    setMismatches(prev =>
      prev.map(m => ids.has(m.id) ? { ...m, resolved: true, workflowStatus: 'resolved' } : m)
    );
    toast.success(`Auto-resolved ${toResolve.length} mismatches with high confidence`);
  };

  // ──────────────────────────────────────────
  // Render: Loading Skeleton
  // ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-[1440px] mx-auto">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-9 w-[160px] rounded-lg" />
            <Skeleton className="h-9 w-40 rounded-lg" />
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-6 py-6">
          <Skeleton className="h-[160px] w-[160px] rounded-full" />
          <div className="grid grid-cols-4 gap-3 flex-1 w-full">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </div>

        <Skeleton className="h-12 w-full rounded-lg" />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="lg:col-span-3 h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────
  // Render: Empty State
  // ──────────────────────────────────────────
  if (isEmpty) {
    return (
      <motion.div
        variants={pageVariants}
        initial="hidden"
        animate="visible"
        className="p-4 md:p-6 max-w-[1440px] mx-auto"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Investigation Center
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Reconcile books with GST portal
            </p>
          </div>
          <Button
            onClick={handleRunReconciliation}
            disabled={runningRecon}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            {runningRecon ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run Reconciliation
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="flex items-center justify-center h-20 w-20 rounded-2xl bg-muted/60 mb-6">
            <GitCompareArrows className="h-10 w-10 text-muted-foreground/60" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No reconciliation data yet
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Upload and review invoices first, then run reconciliation to match your books with GST portal data.
          </p>
          <Button
            onClick={() => setCurrentView('invoices')}
            variant="outline"
            className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Go to Invoices
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  // ──────────────────────────────────────────
  // Render: Main Investigation Center
  // ──────────────────────────────────────────
  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="p-4 md:p-6 max-w-[1440px] mx-auto space-y-5"
    >
      {/* ════════════════════════════════════════════
          1. HEADER
      ════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Investigation Center
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Reconcile books with GST portal
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-[180px] h-9 text-sm bg-background">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.tradeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleAutoResolve}
            variant="outline"
            className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 shadow-sm"
          >
            <Sparkles className="h-4 w-4" />
            Auto Resolve
          </Button>
          <Button
            onClick={handleRunReconciliation}
            disabled={runningRecon}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            {runningRecon ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run Reconciliation
          </Button>
        </div>
      </motion.div>

      {/* ════════════════════════════════════════════
          2. MATCH RATE HERO SECTION
      ════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card className="border-0 shadow-sm bg-gradient-to-b from-background to-muted/20">
          <CardContent className="py-6 px-4 md:px-6">
            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
              {/* SVG Ring */}
              <MatchRateRing
                matchPercent={matchPercent}
                partialPercent={partialPercent}
                mismatchPercent={mismatchPercent}
                size={160}
                strokeWidth={14}
              />

              {/* 4 Category Cards */}
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1 w-full"
              >
                {/* Perfect Match */}
                <motion.div variants={cardEntrance}>
                  <div className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-emerald-50/80 border border-emerald-100">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-[11px] font-medium text-emerald-700">Perfect Match</span>
                    </div>
                    <span className="text-2xl font-bold text-emerald-800">{perfectMatchCount}</span>
                  </div>
                </motion.div>

                {/* Partial Match */}
                <motion.div variants={cardEntrance}>
                  <div className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-amber-50/80 border border-amber-100">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="text-[11px] font-medium text-amber-700">Partial Match</span>
                    </div>
                    <span className="text-2xl font-bold text-amber-800">{partialMatchCount}</span>
                  </div>
                </motion.div>

                {/* Mismatch */}
                <motion.div variants={cardEntrance}>
                  <div className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-red-50/80 border border-red-100">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      <span className="text-[11px] font-medium text-red-700">Mismatch</span>
                    </div>
                    <span className="text-2xl font-bold text-red-800">{mismatches.length}</span>
                    {totalGstDifference > 0 && (
                      <span className="text-[10px] font-semibold text-red-600">
                        {formatCurrency(totalGstDifference)} diff
                      </span>
                    )}
                  </div>
                </motion.div>

                {/* Missing */}
                <motion.div variants={cardEntrance}>
                  <div className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-slate-50/80 border border-slate-200">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-slate-400" />
                      <span className="text-[11px] font-medium text-slate-600">Missing</span>
                    </div>
                    <span className="text-2xl font-bold text-slate-700">
                      {categoryCounts['missing_in_gstr'] + categoryCounts['missing_in_books']}
                    </span>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ════════════════════════════════════════════
          3. MISMATCH CATEGORIES (filter strip)
      ════════════════════════════════════════════ */}
      <div className="flex items-center gap-3">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-none flex-1"
        >
        {/* All button */}
        <button
          onClick={() => setActiveCategory('all')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-medium whitespace-nowrap transition-all ${
            activeCategory === 'all'
              ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm'
              : 'border-border bg-background text-muted-foreground hover:border-emerald-300 hover:bg-emerald-50/30'
          }`}
        >
          <CircleDot className="h-3.5 w-3.5" />
          All
          <span className="ml-0.5 text-[10px] opacity-70">({mismatches.length})</span>
        </button>

          {MISMATCH_CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-medium whitespace-nowrap transition-all ${
                activeCategory === cat.key
                  ? `${cat.activeBorder} ${cat.bgColor} shadow-sm`
                  : 'border-border bg-background text-muted-foreground hover:border-emerald-300 hover:bg-emerald-50/30'
              }`}
            >
              {cat.icon}
              {cat.label}
              <span className="ml-0.5 text-[10px] opacity-70">({categoryCounts[cat.key] || 0})</span>
            </button>
          ))}
        </motion.div>

        {/* Severity Filter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="shrink-0"
        >
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="h-9 w-[140px] text-xs bg-background">
              <SelectValue placeholder="All Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>
      </div>

      {/* ════════════════════════════════════════════
          4 & 5. MAIN CONTENT: TWO-PANEL + TIMELINE
      ════════════════════════════════════════════ */}
      <div className="flex gap-4">
        {/* Two-Panel Investigation View */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 min-w-0">
          {/* ── Left Panel: Mismatch List ── */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            className="lg:col-span-2"
          >
            <Card className="border shadow-sm overflow-hidden h-full">
              <CardHeader className="px-4 py-3 border-b border-border/60">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">
                    Mismatches
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({filteredMismatches.length})
                    </span>
                  </CardTitle>
                  {activeCategory !== 'all' && (
                    <button
                      onClick={() => setActiveCategory('all')}
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
              </CardHeader>
              <ScrollArea className="h-[520px] lg:h-[560px]">
                <div className="p-2.5 space-y-2">
                  <AnimatePresence mode="popLayout">
                    {filteredMismatches.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="py-12 text-center text-xs text-muted-foreground"
                      >
                        No mismatches in this category
                      </motion.div>
                    ) : (
                      filteredMismatches.map((m, i) => (
                        <motion.div
                          key={m.id}
                          variants={cardEntrance}
                          initial="hidden"
                          animate="visible"
                          transition={{ delay: i * 0.04 }}
                          layout
                        >
                          <button
                            onClick={() => setSelectedMismatchId(m.id)}
                            className={`w-full text-left p-3.5 rounded-xl border transition-all group ${
                              selectedMismatchId === m.id
                                ? 'border-l-4 border-l-emerald-500 border-emerald-200 bg-emerald-50/40 shadow-sm'
                                : 'border-border bg-card hover:border-emerald-200 hover:bg-emerald-50/20'
                            } ${m.resolved ? 'opacity-60' : ''}`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-mono font-bold text-foreground">
                                {m.invoiceNumber}
                              </span>
                              {m.resolved && (
                                <Badge variant="outline" className="h-5 text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700">
                                  Resolved
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                                {m.clientName}
                              </span>
                              <Badge
                                variant="outline"
                                className={`h-5 text-[10px] px-1.5 ${getMismatchBadgeClasses(m.mismatchCategory)}`}
                              >
                                {m.mismatchType}
                              </Badge>
                              <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${getSeverityConfig(getMismatchSeverity(m)).bgColor} ${getSeverityConfig(getMismatchSeverity(m)).color}`}>
                                <span className={`size-1.5 rounded-full ${getSeverityConfig(getMismatchSeverity(m)).dotClass}`} />
                                {getSeverityConfig(getMismatchSeverity(m)).label}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              {m.taxDifference > 0 ? (
                                <span className="text-xs font-semibold text-red-700">
                                  {formatCurrency(m.taxDifference)} diff
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                              <div className="flex items-center gap-1">
                                <Sparkles className="h-3 w-3 text-emerald-600" />
                                <span className="text-[10px] font-semibold text-emerald-700">
                                  AI: {m.confidenceScore}%
                                </span>
                              </div>
                            </div>
                          </button>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </Card>
          </motion.div>

          {/* ── Right Panel: Side-by-Side Comparison ── */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-3"
          >
            <AnimatePresence mode="wait">
              {!selectedMismatch ? (
                /* Empty state — no mismatch selected */
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.25 }}
                >
                  <Card className="border shadow-sm h-full min-h-[560px] flex items-center justify-center">
                    <CardContent className="flex flex-col items-center text-center py-16">
                      <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-muted/50 mb-4">
                        <Eye className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground mb-1">
                        Select a mismatch to investigate
                      </h3>
                      <p className="text-xs text-muted-foreground max-w-[240px]">
                        Click on any mismatch from the list to see a detailed side-by-side comparison
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                /* Selected mismatch — comparison view */
                <motion.div
                  key={selectedMismatch.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="border shadow-sm overflow-hidden">
                    <CardHeader className="px-4 py-3 border-b border-border/60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-sm font-semibold font-mono">
                            {selectedMismatch.invoiceNumber}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className={`h-5 text-[10px] ${getMismatchBadgeClasses(selectedMismatch.mismatchCategory)}`}
                          >
                            {selectedMismatch.mismatchType}
                          </Badge>
                        </div>
                        {selectedMismatch.resolved && (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Resolved
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs mt-0.5">
                        {selectedMismatch.clientName}
                        {selectedMismatch.taxDifference > 0 && (
                          <span className="text-red-600 font-medium ml-2">
                            • {formatCurrency(selectedMismatch.taxDifference)} GST difference
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>

                    <ScrollArea className="max-h-[520px]">
                      <div className="p-4 space-y-4">
                        {/* ── Side-by-Side Comparison ── */}
                        <div className="rounded-xl border border-border overflow-hidden">
                          {/* Header row */}
                          <div className="grid grid-cols-[1fr_1fr_1fr] bg-muted/30">
                            <div className="px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                              Field
                            </div>
                            <div className="px-3 py-2 text-[11px] font-semibold text-emerald-700 uppercase tracking-wider bg-emerald-50/50 flex items-center gap-1.5">
                              <ShieldCheck className="h-3 w-3" />
                              Your Books
                            </div>
                            <div className="px-3 py-2 text-[11px] font-semibold text-amber-700 uppercase tracking-wider bg-amber-50/50 flex items-center gap-1.5">
                              <ShieldAlert className="h-3 w-3" />
                              GSTR-2B Data
                            </div>
                          </div>

                          {/* Data rows */}
                          <ComparisonField
                            label="Invoice #"
                            booksValue={selectedMismatch.booksData.invoiceNumber}
                            gstr2bValue={selectedMismatch.gstr2bData?.invoiceNumber || '—'}
                            isDiff={selectedMismatch.diffFields.includes('invoice_number')}
                          />
                          <ComparisonField
                            label="Date"
                            booksValue={selectedMismatch.booksData.invoiceDate}
                            gstr2bValue={selectedMismatch.gstr2bData?.invoiceDate || '—'}
                            isDiff={selectedMismatch.diffFields.includes('invoice_date')}
                          />
                          <ComparisonField
                            label="Seller GSTIN"
                            booksValue={selectedMismatch.booksData.sellerGstin}
                            gstr2bValue={selectedMismatch.gstr2bData?.sellerGstin || '—'}
                            isDiff={selectedMismatch.diffFields.includes('sellerGstin') || selectedMismatch.diffFields.includes('vendor_gstin')}
                          />
                          <ComparisonField
                            label="Buyer GSTIN"
                            booksValue={selectedMismatch.booksData.buyerGstin || '—'}
                            gstr2bValue={selectedMismatch.gstr2bData?.buyerGstin || '—'}
                            isDiff={selectedMismatch.diffFields.includes('buyerGstin')}
                          />
                          <ComparisonField
                            label="Taxable Value"
                            booksValue={selectedMismatch.booksData.taxableValue > 0 ? formatCurrency(selectedMismatch.booksData.taxableValue) : '—'}
                            gstr2bValue={selectedMismatch.gstr2bData && selectedMismatch.gstr2bData.taxableValue > 0 ? formatCurrency(selectedMismatch.gstr2bData.taxableValue) : '—'}
                            isDiff={selectedMismatch.diffFields.includes('taxableValue')}
                          />
                          <ComparisonField
                            label="CGST"
                            booksValue={selectedMismatch.booksData.cgst > 0 ? formatCurrency(selectedMismatch.booksData.cgst) : '—'}
                            gstr2bValue={selectedMismatch.gstr2bData && selectedMismatch.gstr2bData.cgst > 0 ? formatCurrency(selectedMismatch.gstr2bData.cgst) : '—'}
                            isDiff={selectedMismatch.diffFields.includes('cgst') || selectedMismatch.diffFields.includes('gst_amount')}
                          />
                          <ComparisonField
                            label="SGST"
                            booksValue={selectedMismatch.booksData.sgst > 0 ? formatCurrency(selectedMismatch.booksData.sgst) : '—'}
                            gstr2bValue={selectedMismatch.gstr2bData && selectedMismatch.gstr2bData.sgst > 0 ? formatCurrency(selectedMismatch.gstr2bData.sgst) : '—'}
                            isDiff={selectedMismatch.diffFields.includes('sgst')}
                          />
                          <ComparisonField
                            label="IGST"
                            booksValue={selectedMismatch.booksData.igst > 0 ? formatCurrency(selectedMismatch.booksData.igst) : '—'}
                            gstr2bValue={selectedMismatch.gstr2bData && selectedMismatch.gstr2bData.igst > 0 ? formatCurrency(selectedMismatch.gstr2bData.igst) : '—'}
                            isDiff={selectedMismatch.diffFields.includes('igst')}
                          />
                          <ComparisonField
                            label="Total"
                            booksValue={selectedMismatch.booksData.totalAmount > 0 ? formatCurrency(selectedMismatch.booksData.totalAmount) : '—'}
                            gstr2bValue={selectedMismatch.gstr2bData && selectedMismatch.gstr2bData.totalAmount > 0 ? formatCurrency(selectedMismatch.gstr2bData.totalAmount) : '—'}
                            isDiff={selectedMismatch.diffFields.includes('totalAmount') || selectedMismatch.diffFields.includes('total_amount')}
                          />
                        </div>

                        {/* ── AI Recommendation Card ── */}
                        {!selectedMismatch.resolved && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                          >
                            <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/60 to-teal-50/30">
                              <CardContent className="py-3.5 px-4">
                                <div className="flex items-start gap-3">
                                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-100 mt-0.5 shrink-0">
                                    <Sparkles className="h-4 w-4 text-emerald-700" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs font-semibold text-emerald-800">
                                        AI suggests: {selectedMismatch.aiRecommendation.split('—')[0].trim()}
                                      </span>
                                      <Badge variant="outline" className="h-5 text-[10px] border-emerald-300 bg-emerald-50 text-emerald-700 shrink-0">
                                        {selectedMismatch.confidenceScore}% confidence
                                      </Badge>
                                    </div>
                                    <p className="text-[11px] text-emerald-700/90 leading-relaxed">
                                      {selectedMismatch.aiRecommendation}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        )}

                        {/* ── AI Explanation ── */}
                        <div className="rounded-lg bg-muted/40 border border-border/50 px-3.5 py-2.5">
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            <span className="font-medium text-foreground">AI Summary:</span>{' '}
                            {selectedMismatch.aiExplanation}
                          </p>
                        </div>

                        {/* ── Action Buttons ── */}
                        {!selectedMismatch.resolved && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="flex flex-col sm:flex-row gap-2 pt-1"
                          >
                            <Button
                              onClick={() => handleAcceptGSTR2B(selectedMismatch.id)}
                              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex-1"
                              size="sm"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Accept GSTR-2B
                            </Button>
                            <Button
                              onClick={() => handleKeepBooks(selectedMismatch.id)}
                              variant="secondary"
                              className="gap-1.5 flex-1"
                              size="sm"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Keep Books Value
                            </Button>
                            <Button
                              onClick={() => handleCustomResolution(selectedMismatch.id)}
                              variant="outline"
                              className="gap-1.5 flex-1"
                              size="sm"
                            >
                              <AlertCircle className="h-3.5 w-3.5" />
                              Custom Resolution
                            </Button>
                          </motion.div>
                        )}
                      </div>
                    </ScrollArea>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ── Reconciliation Timeline Sidebar ── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.45 }}
          className={`hidden xl:block ${timelineCollapsed ? 'w-10' : 'w-[220px]'} shrink-0 transition-all duration-300`}
        >
          <Card className="border shadow-sm overflow-hidden h-full">
            <CardHeader className="px-3 py-2.5 border-b border-border/60 flex flex-row items-center justify-between space-y-0">
              {!timelineCollapsed && (
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                  Recon Timeline
                </CardTitle>
              )}
              <button
                onClick={() => setTimelineCollapsed(!timelineCollapsed)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${timelineCollapsed ? '' : 'rotate-180'}`} />
              </button>
            </CardHeader>
            {!timelineCollapsed && (
              <ScrollArea className="h-[560px]">
                <div className="p-2.5 space-y-1.5">
                  {timeline.map((entry, i) => {
                    const entryDate = new Date(entry.date);
                    const formattedDate = entryDate.toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: '2-digit',
                    });
                    const formattedTime = entryDate.toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    });

                    return (
                      <motion.button
                        key={entry.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.05 }}
                        className="w-full text-left p-2.5 rounded-lg border border-border/50 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group"
                        onClick={() => {
                          toast.info(`Loading run from ${formattedDate}...`);
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Clock className="h-3 w-3 text-muted-foreground group-hover:text-emerald-600 transition-colors" />
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {formattedDate} · {formattedTime}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-foreground truncate mb-0.5">
                          {entry.clients}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">
                            {entry.recordsProcessed} records
                          </span>
                          <Badge
                            variant="outline"
                            className={`h-4 text-[9px] px-1 ${
                              entry.matchRate >= 80
                                ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                                : entry.matchRate >= 60
                                ? 'border-amber-200 text-amber-700 bg-amber-50'
                                : 'border-red-200 text-red-700 bg-red-50'
                            }`}
                          >
                            {entry.matchRate}%
                          </Badge>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
