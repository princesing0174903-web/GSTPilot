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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  ArrowRight,
  Search,
  Handshake,
  Sparkles,
  PartyPopper,
  Upload,
  Loader2,
  FileSpreadsheet,
  GitCompareArrows,
} from 'lucide-react';
import { formatCurrency } from '@/lib/gst-utils';
import { useApp } from '@/contexts/AppContext';
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

interface ReconResult {
  id: string;
  clientId: string;
  invoiceId: string;
  matchStatus: string;
  matchScore: number;
  mismatches?: string;
  aiExplanation?: string;
  aiRecommendation?: string;
  confidenceScore: number;
  workflowStatus: string;
  resolved: boolean;
  sourceA?: string;
  sourceB?: string;
  sourceGstin?: string;
  matchedGstin?: string;
  createdAt: string;
  invoice?: {
    invoiceNumber: string;
    invoiceDate: string;
    sellerGstin: string;
    buyerGstin?: string;
    buyerName?: string;
    totalAmount: number;
    cgst: number;
    sgst: number;
    igst: number;
    taxableValue: number;
    client?: { id: string; tradeName: string; gstin: string };
  };
}

interface ReconRun {
  id: string;
  clientId: string;
  period: string;
  sources: string;
  totalRecords: number;
  matched: number;
  unmatched: number;
  partialMatches: number;
  highRisk: number;
  gstDifference: number;
  status: string;
  createdAt: string;
}

interface StatsData {
  totalResults: number;
  matchBreakdown: Record<string, number>;
  matchPercentage: number;
  unresolved: number;
  totalGstDifference: number;
}

// ──────────────────────────────────────────────
// Mock Data Fallback
// ──────────────────────────────────────────────
const MOCK_CLIENTS: ClientOption[] = [
  { id: 'cl-1', tradeName: 'Sharma & Associates', gstin: '27AABCS1429B1Z5' },
  { id: 'cl-2', tradeName: 'Patel Enterprises', gstin: '24AABCP1234B1Z3' },
  { id: 'cl-3', tradeName: 'Mehta Infra Pvt Ltd', gstin: '27AABCM5678B1Z1' },
  { id: 'cl-4', tradeName: 'Reddy Constructions', gstin: '36AABCR9012B1Z9' },
];

const MOCK_RESULTS: ReconResult[] = [
  {
    id: 'recon-1', clientId: 'cl-1', invoiceId: 'inv-1', matchStatus: 'perfect_match',
    matchScore: 98, confidenceScore: 97, workflowStatus: 'resolved', resolved: true,
    sourceA: 'Purchase Register', sourceB: 'GSTR-2B', sourceGstin: '27AABCS1429B1Z5',
    createdAt: '2026-03-01T10:00:00Z',
    invoice: {
      invoiceNumber: 'INV-2026-001', invoiceDate: '2026-02-15', sellerGstin: '27AABCS1429B1Z5',
      totalAmount: 118000, cgst: 9000, sgst: 9000, igst: 0, taxableValue: 100000,
      client: { id: 'cl-1', tradeName: 'Sharma & Associates', gstin: '27AABCS1429B1Z5' },
    },
  },
  {
    id: 'recon-2', clientId: 'cl-2', invoiceId: 'inv-2', matchStatus: 'perfect_match',
    matchScore: 95, confidenceScore: 94, workflowStatus: 'resolved', resolved: true,
    sourceA: 'Purchase Register', sourceB: 'GSTR-2B', sourceGstin: '24AABCP1234B1Z3',
    createdAt: '2026-03-01T10:01:00Z',
    invoice: {
      invoiceNumber: 'INV-2026-012', invoiceDate: '2026-02-18', sellerGstin: '24AABCP1234B1Z3',
      totalAmount: 59000, cgst: 4500, sgst: 4500, igst: 0, taxableValue: 50000,
      client: { id: 'cl-2', tradeName: 'Patel Enterprises', gstin: '24AABCP1234B1Z3' },
    },
  },
  {
    id: 'recon-3', clientId: 'cl-3', invoiceId: 'inv-3', matchStatus: 'perfect_match',
    matchScore: 100, confidenceScore: 99, workflowStatus: 'resolved', resolved: true,
    sourceA: 'Purchase Register', sourceB: 'GSTR-2B', sourceGstin: '27AABCM5678B1Z1',
    createdAt: '2026-03-01T10:02:00Z',
    invoice: {
      invoiceNumber: 'INV-2026-023', invoiceDate: '2026-02-20', sellerGstin: '27AABCM5678B1Z1',
      totalAmount: 236000, cgst: 18000, sgst: 18000, igst: 0, taxableValue: 200000,
      client: { id: 'cl-3', tradeName: 'Mehta Infra Pvt Ltd', gstin: '27AABCM5678B1Z1' },
    },
  },
  {
    id: 'recon-4', clientId: 'cl-4', invoiceId: 'inv-4', matchStatus: 'perfect_match',
    matchScore: 97, confidenceScore: 96, workflowStatus: 'resolved', resolved: true,
    sourceA: 'Purchase Register', sourceB: 'GSTR-2B', sourceGstin: '36AABCR9012B1Z9',
    createdAt: '2026-03-01T10:03:00Z',
    invoice: {
      invoiceNumber: 'INV-2026-034', invoiceDate: '2026-02-22', sellerGstin: '36AABCR9012B1Z9',
      totalAmount: 35400, cgst: 2700, sgst: 2700, igst: 0, taxableValue: 30000,
      client: { id: 'cl-4', tradeName: 'Reddy Constructions', gstin: '36AABCR9012B1Z9' },
    },
  },
  {
    id: 'recon-5', clientId: 'cl-1', invoiceId: 'inv-5', matchStatus: 'mismatch',
    matchScore: 62, confidenceScore: 78, workflowStatus: 'pending', resolved: false,
    sourceA: 'Purchase Register', sourceB: 'GSTR-2B', sourceGstin: '27AABCS1429B1Z5',
    mismatches: JSON.stringify([
      { field: 'gst_amount', expected: 16200, actual: 15390, difference: 810 },
      { field: 'total_amount', expected: 106200, actual: 105390, difference: 810 },
    ]),
    aiExplanation: 'GST amount mismatch detected between Purchase Register (₹16,200) and GSTR-2B (₹15,390). Difference of ₹810 may be due to rate change or partial credit note.',
    aiRecommendation: 'adjust_gst_amount',
    createdAt: '2026-03-01T10:04:00Z',
    invoice: {
      invoiceNumber: 'INV-2026-045', invoiceDate: '2026-02-25', sellerGstin: '27AABCS1429B1Z5',
      totalAmount: 106200, cgst: 8100, sgst: 8100, igst: 0, taxableValue: 90000,
      client: { id: 'cl-1', tradeName: 'Sharma & Associates', gstin: '27AABCS1429B1Z5' },
    },
  },
  {
    id: 'recon-6', clientId: 'cl-2', invoiceId: 'inv-6', matchStatus: 'partial_match',
    matchScore: 78, confidenceScore: 85, workflowStatus: 'pending', resolved: false,
    sourceA: 'Purchase Register', sourceB: 'GSTR-2B', sourceGstin: '24AABCP1234B1Z3',
    mismatches: JSON.stringify([
      { field: 'vendor_gstin', expected: '24AABCP1234B1Z3', actual: '24AABCP1234B1Z4' },
    ]),
    aiExplanation: 'Vendor GSTIN shows minor discrepancy — last character differs by 1. This may be a data entry error in GSTR-2B.',
    aiRecommendation: 'correct_gstin',
    createdAt: '2026-03-01T10:05:00Z',
    invoice: {
      invoiceNumber: 'INV-2026-056', invoiceDate: '2026-02-26', sellerGstin: '24AABCP1234B1Z3',
      totalAmount: 70800, cgst: 5400, sgst: 5400, igst: 0, taxableValue: 60000,
      client: { id: 'cl-2', tradeName: 'Patel Enterprises', gstin: '24AABCP1234B1Z3' },
    },
  },
  {
    id: 'recon-7', clientId: 'cl-3', invoiceId: 'inv-7', matchStatus: 'mismatch',
    matchScore: 45, confidenceScore: 72, workflowStatus: 'pending', resolved: false,
    sourceA: 'Purchase Register', sourceB: 'GSTR-2B', sourceGstin: '27AABCM5678B1Z1',
    mismatches: JSON.stringify([
      { field: 'gst_amount', expected: 27000, actual: 25650, difference: 1350 },
      { field: 'invoice_date', expected: '2026-02-28', actual: '2026-03-15', difference: 15 },
    ]),
    aiExplanation: 'Multiple mismatches: GST amount difference of ₹1,350 and invoice date shifted by 15 days. Likely a delayed upload by vendor with revised figures.',
    aiRecommendation: 'review_manually',
    createdAt: '2026-03-01T10:06:00Z',
    invoice: {
      invoiceNumber: 'INV-2026-067', invoiceDate: '2026-02-28', sellerGstin: '27AABCM5678B1Z1',
      totalAmount: 177000, cgst: 13500, sgst: 13500, igst: 0, taxableValue: 150000,
      client: { id: 'cl-3', tradeName: 'Mehta Infra Pvt Ltd', gstin: '27AABCM5678B1Z1' },
    },
  },
  {
    id: 'recon-8', clientId: 'cl-1', invoiceId: 'inv-8', matchStatus: 'missing_in_gstr',
    matchScore: 0, confidenceScore: 90, workflowStatus: 'pending', resolved: false,
    sourceA: 'Purchase Register', sourceB: 'GSTR-2B', sourceGstin: '27AABCS1429B1Z5',
    aiExplanation: 'Invoice present in Purchase Register but not found in GSTR-2B. Vendor may not have uploaded this invoice. ITC at risk if not resolved.',
    aiRecommendation: 'review_manually',
    createdAt: '2026-03-01T10:07:00Z',
    invoice: {
      invoiceNumber: 'INV-2026-078', invoiceDate: '2026-02-10', sellerGstin: '27AABCS1429B1Z5',
      totalAmount: 47200, cgst: 3600, sgst: 3600, igst: 0, taxableValue: 40000,
      client: { id: 'cl-1', tradeName: 'Sharma & Associates', gstin: '27AABCS1429B1Z5' },
    },
  },
  {
    id: 'recon-9', clientId: 'cl-4', invoiceId: 'inv-9', matchStatus: 'missing_in_books',
    matchScore: 0, confidenceScore: 88, workflowStatus: 'pending', resolved: false,
    sourceA: 'Purchase Register', sourceB: 'GSTR-2B', sourceGstin: '36AABCR9012B1Z9',
    aiExplanation: 'Invoice appears in GSTR-2B but is not recorded in the Purchase Register. Possible missed entry or vendor misclassification.',
    aiRecommendation: 'review_vendor_data',
    createdAt: '2026-03-01T10:08:00Z',
    invoice: {
      invoiceNumber: 'GSTR2B-INV-901', invoiceDate: '2026-02-14', sellerGstin: '36AABCR9012B1Z9',
      totalAmount: 23600, cgst: 1800, sgst: 1800, igst: 0, taxableValue: 20000,
      client: { id: 'cl-4', tradeName: 'Reddy Constructions', gstin: '36AABCR9012B1Z9' },
    },
  },
  {
    id: 'recon-10', clientId: 'cl-2', invoiceId: 'inv-10', matchStatus: 'missing_in_gstr',
    matchScore: 0, confidenceScore: 92, workflowStatus: 'pending', resolved: false,
    sourceA: 'Purchase Register', sourceB: 'GSTR-2B', sourceGstin: '24AABCP1234B1Z3',
    aiExplanation: 'Invoice not found in GSTR-2B data. This ITC of ₹5,400 may be at risk. Contact vendor to ensure timely upload.',
    aiRecommendation: 'review_manually',
    createdAt: '2026-03-01T10:09:00Z',
    invoice: {
      invoiceNumber: 'INV-2026-089', invoiceDate: '2026-02-12', sellerGstin: '24AABCP1234B1Z3',
      totalAmount: 35400, cgst: 2700, sgst: 2700, igst: 0, taxableValue: 30000,
      client: { id: 'cl-2', tradeName: 'Patel Enterprises', gstin: '24AABCP1234B1Z3' },
    },
  },
  {
    id: 'recon-11', clientId: 'cl-3', invoiceId: 'inv-11', matchStatus: 'duplicate',
    matchScore: 50, confidenceScore: 85, workflowStatus: 'pending', resolved: false,
    sourceA: 'Purchase Register', sourceB: 'GSTR-2B', sourceGstin: '27AABCM5678B1Z1',
    mismatches: JSON.stringify([]),
    aiExplanation: 'Duplicate invoice detected — same invoice number and GSTIN found multiple times with identical amounts.',
    aiRecommendation: 'mark_as_duplicate',
    createdAt: '2026-03-01T10:10:00Z',
    invoice: {
      invoiceNumber: 'INV-2026-001', invoiceDate: '2026-02-15', sellerGstin: '27AABCM5678B1Z1',
      totalAmount: 118000, cgst: 9000, sgst: 9000, igst: 0, taxableValue: 100000,
      client: { id: 'cl-3', tradeName: 'Mehta Infra Pvt Ltd', gstin: '27AABCM5678B1Z1' },
    },
  },
];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function parseMismatches(raw?: string | null): { field: string; expected: string | number; actual: string | number; difference?: number }[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function getMismatchType(result: ReconResult): string {
  const status = result.matchStatus;
  if (status === 'missing_in_gstr') return 'Missing in 2B';
  if (status === 'missing_in_books') return 'Missing in Books';
  if (status === 'duplicate') return 'Duplicate';
  const mm = parseMismatches(result.mismatches);
  if (mm.some(m => m.field === 'vendor_gstin')) return 'GSTIN Mismatch';
  if (mm.some(m => m.field === 'gst_amount' || m.field === 'total_amount')) return 'Amount Mismatch';
  if (mm.some(m => m.field === 'invoice_date')) return 'Date Mismatch';
  return 'Partial Match';
}

function getMismatchBadgeStyle(mismatchType: string) {
  switch (mismatchType) {
    case 'Amount Mismatch':
      return 'border-amber-300 bg-amber-50 text-amber-800';
    case 'GSTIN Mismatch':
      return 'border-orange-300 bg-orange-50 text-orange-800';
    case 'Date Mismatch':
      return 'border-teal-300 bg-teal-50 text-teal-800';
    case 'Missing in 2B':
      return 'border-rose-300 bg-rose-50 text-rose-800';
    case 'Missing in Books':
      return 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800';
    case 'Duplicate':
      return 'border-violet-300 bg-violet-50 text-violet-800';
    default:
      return 'border-slate-300 bg-slate-50 text-slate-700';
  }
}

function getSourceLabel(result: ReconResult): string {
  if (result.matchStatus === 'missing_in_gstr') return 'Books';
  if (result.matchStatus === 'missing_in_books') return 'GSTR-2B';
  return result.sourceA || 'Books';
}

// ──────────────────────────────────────────────
// Animated Match Rate Ring (SVG Donut)
// ──────────────────────────────────────────────
function MatchRateRing({
  value,
  size = 180,
  strokeWidth = 12,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const color = value >= 90 ? '#10b981' : value >= 70 ? '#f59e0b' : '#ef4444';
  const bgTrack = '#f1f5f9';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgTrack}
          strokeWidth={strokeWidth}
        />
        {/* Subtle glow filter */}
        <defs>
          <filter id="ringGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Animated progress arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          filter="url(#ringGlow)"
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-4xl font-bold tracking-tight"
          style={{ color }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.5, type: 'spring' }}
        >
          {value}%
        </motion.span>
        <span className="text-xs font-medium text-muted-foreground mt-0.5">Match Rate</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Animation Variants
// ──────────────────────────────────────────────
const pageVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const cardEntrance = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: 'easeOut' } },
};

const columnEntrance = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
export default function ReconciliationPage() {
  const { selectedClientId, setCurrentView } = useApp();

  // ── Data ──
  const [results, setResults] = useState<ReconResult[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);

  // ── Loading ──
  const [loading, setLoading] = useState(true);
  const [runningRecon, setRunningRecon] = useState(false);

  // ── Filters ──
  const [filterClient, setFilterClient] = useState<string>('all');

  // ── Dialogs ──
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ReconResult | null>(null);

  // ── Resolve Form ──
  const [resolveChoice, setResolveChoice] = useState<'gstr2b' | 'books' | 'custom'>('gstr2b');

  // ──────────────────────────────────────────
  // Data Fetching
  // ──────────────────────────────────────────
  const fetchResults = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedClientId) params.set('clientId', selectedClientId);
      const res = await fetch(`/api/reconciliation?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        return;
      }
    } catch (err) {
      console.error('Error fetching results:', err);
    }
    // Mock fallback
    setResults(MOCK_RESULTS);
  }, [selectedClientId]);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients');
      if (res.ok) {
        const data = await res.json();
        setClients(
          (data.clients || []).map((c: { id: string; tradeName: string; gstin: string }) => ({
            id: c.id,
            tradeName: c.tradeName,
            gstin: c.gstin,
          }))
        );
        return;
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    }
    setClients(MOCK_CLIENTS);
  }, []);

  // ── Initial Load ──
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      await Promise.all([fetchResults(), fetchClients()]);
      setLoading(false);
    }
    loadAll();
  }, [fetchResults, fetchClients]);

  // ── Refetch on client change ──
  useEffect(() => {
    if (!loading) {
      fetchResults();
    }
  }, [selectedClientId, fetchResults, loading]);

  // ──────────────────────────────────────────
  // Computed Values
  // ──────────────────────────────────────────
  const filteredResults = useMemo(() => {
    if (filterClient === 'all') return results;
    return results.filter(r => r.clientId === filterClient);
  }, [results, filterClient]);

  const summary = useMemo(() => {
    const total = filteredResults.length;
    const matched = filteredResults.filter(r => r.matchStatus === 'perfect_match').length;
    const mismatched = filteredResults.filter(
      r => r.matchStatus === 'partial_match' || r.matchStatus === 'mismatch'
    ).length;
    const unmatched = filteredResults.filter(
      r =>
        r.matchStatus === 'missing_in_books' ||
        r.matchStatus === 'missing_in_gstr' ||
        r.matchStatus === 'unmatched' ||
        r.matchStatus === 'duplicate'
    ).length;
    return {
      total,
      matched,
      mismatched,
      unmatched,
      matchRate: total > 0 ? Math.round((matched / total) * 100) : 0,
    };
  }, [filteredResults]);

  const matchedResults = useMemo(
    () => filteredResults.filter(r => r.matchStatus === 'perfect_match'),
    [filteredResults]
  );

  const mismatchResults = useMemo(
    () => filteredResults.filter(r => r.matchStatus === 'partial_match' || r.matchStatus === 'mismatch'),
    [filteredResults]
  );

  const unmatchedResults = useMemo(
    () =>
      filteredResults.filter(
        r =>
          r.matchStatus === 'missing_in_books' ||
          r.matchStatus === 'missing_in_gstr' ||
          r.matchStatus === 'unmatched' ||
          r.matchStatus === 'duplicate'
      ),
    [filteredResults]
  );

  const isPerfect = summary.matchRate === 100 && summary.total > 0;
  const isEmpty = summary.total === 0;

  // ──────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────
  const handleRunReconciliation = async () => {
    setRunningRecon(true);
    try {
      const clientId = selectedClientId || (filterClient !== 'all' ? filterClient : null);
      if (!clientId) {
        setRunningRecon(false);
        return;
      }
      const res = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run',
          clientId,
          period: '2026-03',
          sources: 'Purchase Register,GSTR-2B',
        }),
      });
      if (res.ok) {
        await fetchResults();
      }
    } catch (err) {
      console.error('Error running reconciliation:', err);
    } finally {
      setRunningRecon(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedResult) return;
    try {
      await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_workflow',
          id: selectedResult.id,
          workflowStatus: 'resolved',
        }),
      });
      setResults(prev =>
        prev.map(r =>
          r.id === selectedResult.id
            ? { ...r, resolved: true, workflowStatus: 'resolved' }
            : r
        )
      );
      setResolveDialogOpen(false);
      setSelectedResult(null);
      setResolveChoice('gstr2b');
    } catch (err) {
      console.error('Error resolving:', err);
    }
  };

  const handleIgnore = async (id: string) => {
    try {
      await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_workflow', id, workflowStatus: 'ignored' }),
      });
      setResults(prev =>
        prev.map(r => r.id === id ? { ...r, workflowStatus: 'ignored' } : r)
      );
    } catch (err) {
      console.error('Error ignoring:', err);
    }
  };

  const openResolveDialog = (result: ReconResult) => {
    setSelectedResult(result);
    setResolveChoice('gstr2b');
    setResolveDialogOpen(true);
  };

  // ──────────────────────────────────────────
  // Render: Loading Skeleton
  // ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-[1440px] mx-auto">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-48 rounded-lg" />
        </div>

        {/* Match Rate Hero skeleton */}
        <div className="flex flex-col items-center gap-6 py-4">
          <Skeleton className="h-[180px] w-[180px] rounded-full" />
          <div className="grid grid-cols-3 gap-4 w-full max-w-md">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        </div>

        {/* Kanban skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-10 rounded-lg" />
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-28 rounded-xl" />
              ))}
            </div>
          ))}
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Reconcile
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Match your books with GST portal data
            </p>
          </div>
          <Button
            onClick={handleRunReconciliation}
            disabled={runningRecon || !selectedClientId}
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

        {/* Empty State */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="flex items-center justify-center h-20 w-20 rounded-2xl bg-muted/60 mb-6">
            <GitCompareArrows className="h-10 w-10 text-muted-foreground/60" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No reconciliation data yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Upload and review documents first, then run reconciliation to match your books with GST portal data.
          </p>
          <Button
            onClick={() => setCurrentView('upload')}
            variant="outline"
            className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            <Upload className="h-4 w-4" />
            Go to Upload
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  // ──────────────────────────────────────────
  // Render: Main
  // ──────────────────────────────────────────
  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="p-4 md:p-6 max-w-[1440px] mx-auto space-y-8"
    >
      {/* ════════════════════════════════════════════
          1. Page Header
      ════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Reconcile
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Match your books with GST portal data
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Client Filter */}
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
            onClick={handleRunReconciliation}
            disabled={runningRecon || !selectedClientId}
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
          2. Match Rate Hero
      ════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        <Card className="border-0 shadow-sm bg-gradient-to-b from-background to-muted/20">
          <CardContent className="py-8 flex flex-col items-center gap-6">
            {/* Ring */}
            <MatchRateRing value={summary.matchRate} size={180} strokeWidth={14} />

            {/* 3 Stat Cards */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-3 gap-3 sm:gap-4 w-full max-w-md"
            >
              {/* Matched */}
              <motion.div variants={cardEntrance}>
                <div className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl bg-emerald-50/80 border border-emerald-100">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="text-[11px] font-medium text-emerald-700">Matched</span>
                  </div>
                  <span className="text-xl sm:text-2xl font-bold text-emerald-800">{summary.matched}</span>
                </div>
              </motion.div>

              {/* Mismatch */}
              <motion.div variants={cardEntrance}>
                <div className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl bg-amber-50/80 border border-amber-100">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-[11px] font-medium text-amber-700">Mismatch</span>
                  </div>
                  <span className="text-xl sm:text-2xl font-bold text-amber-800">{summary.mismatched}</span>
                </div>
              </motion.div>

              {/* Unmatched */}
              <motion.div variants={cardEntrance}>
                <div className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl bg-red-50/80 border border-red-100">
                  <div className="flex items-center gap-1.5">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-[11px] font-medium text-red-700">Unmatched</span>
                  </div>
                  <span className="text-xl sm:text-2xl font-bold text-red-800">{summary.unmatched}</span>
                </div>
              </motion.div>
            </motion.div>

            {/* 100% celebration */}
            <AnimatePresence>
              {isPerfect && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200"
                >
                  <PartyPopper className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-800">100% Match Rate!</span>
                  <PartyPopper className="h-4 w-4 text-emerald-600" />
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* ════════════════════════════════════════════
          3. Kanban Columns
      ════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5"
      >
        {/* ── Matched Column ── */}
        <motion.div variants={columnEntrance} initial="hidden" animate="visible">
          <div className="rounded-t-xl border-t-4 border-t-emerald-500 bg-card border border-border shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-border/60">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-foreground">Matched</h3>
              </div>
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] h-5">
                {matchedResults.length}
              </Badge>
            </div>
            <ScrollArea className="h-[460px]">
              <div className="p-2.5 space-y-2.5">
                <AnimatePresence>
                  {matchedResults.length === 0 ? (
                    <div className="py-10 text-center text-xs text-muted-foreground">
                      No matched invoices
                    </div>
                  ) : (
                    matchedResults.map((r, i) => (
                      <motion.div
                        key={r.id}
                        variants={cardEntrance}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: i * 0.05 }}
                      >
                        <div className="group p-3 rounded-lg border border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50/60 hover:border-emerald-200 transition-all cursor-default">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-mono font-semibold text-foreground">
                              {r.invoice?.invoiceNumber || '—'}
                            </span>
                            <Badge variant="outline" className="h-5 text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700">
                              {r.matchScore}%
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                              {r.invoice?.client?.tradeName || '—'}
                            </span>
                            <span className="text-xs font-semibold text-foreground">
                              {formatCurrency(r.invoice?.totalAmount || 0)}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>
        </motion.div>

        {/* ── Mismatch Column ── */}
        <motion.div variants={columnEntrance} initial="hidden" animate="visible" transition={{ delay: 0.1 }}>
          <div className="rounded-t-xl border-t-4 border-t-amber-500 bg-card border border-border shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-border/60">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-foreground">Mismatch</h3>
              </div>
              <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-[11px] h-5">
                {mismatchResults.length}
              </Badge>
            </div>
            <ScrollArea className="h-[460px]">
              <div className="p-2.5 space-y-2.5">
                <AnimatePresence>
                  {mismatchResults.length === 0 ? (
                    <div className="py-10 text-center text-xs text-muted-foreground">
                      No mismatches found
                    </div>
                  ) : (
                    mismatchResults.map((r, i) => {
                      const mismatchType = getMismatchType(r);
                      return (
                        <motion.div
                          key={r.id}
                          variants={cardEntrance}
                          initial="hidden"
                          animate="visible"
                          transition={{ delay: i * 0.05 }}
                        >
                          <div className="group p-3 rounded-lg border border-amber-100 bg-amber-50/20 hover:bg-amber-50/40 hover:border-amber-200 transition-all">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-mono font-semibold text-foreground">
                                {r.invoice?.invoiceNumber || '—'}
                              </span>
                              <Badge
                                variant="outline"
                                className={`h-5 text-[10px] ${getMismatchBadgeStyle(mismatchType)}`}
                              >
                                {mismatchType}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">
                                {r.invoice?.client?.tradeName || '—'}
                              </span>
                              <span className="text-xs font-semibold text-foreground">
                                {formatCurrency(r.invoice?.totalAmount || 0)}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              className="w-full h-7 text-[11px] gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                              onClick={() => openResolveDialog(r)}
                            >
                              <Handshake className="h-3 w-3" />
                              Resolve
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>
        </motion.div>

        {/* ── Unmatched Column ── */}
        <motion.div variants={columnEntrance} initial="hidden" animate="visible" transition={{ delay: 0.2 }}>
          <div className="rounded-t-xl border-t-4 border-t-red-500 bg-card border border-border shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-border/60">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <h3 className="text-sm font-semibold text-foreground">Unmatched</h3>
              </div>
              <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200 text-[11px] h-5">
                {unmatchedResults.length}
              </Badge>
            </div>
            <ScrollArea className="h-[460px]">
              <div className="p-2.5 space-y-2.5">
                <AnimatePresence>
                  {unmatchedResults.length === 0 ? (
                    <div className="py-10 text-center text-xs text-muted-foreground">
                      No unmatched invoices
                    </div>
                  ) : (
                    unmatchedResults.map((r, i) => {
                      const mismatchType = getMismatchType(r);
                      return (
                        <motion.div
                          key={r.id}
                          variants={cardEntrance}
                          initial="hidden"
                          animate="visible"
                          transition={{ delay: i * 0.05 }}
                        >
                          <div className="group p-3 rounded-lg border border-red-100 bg-red-50/20 hover:bg-red-50/40 hover:border-red-200 transition-all">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-mono font-semibold text-foreground">
                                {r.invoice?.invoiceNumber || '—'}
                              </span>
                              <Badge
                                variant="outline"
                                className={`h-5 text-[10px] ${getMismatchBadgeStyle(mismatchType)}`}
                              >
                                {mismatchType}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] text-muted-foreground">
                                Source: <span className="font-medium text-foreground">{getSourceLabel(r)}</span>
                              </span>
                              <span className="text-xs font-semibold text-foreground">
                                {formatCurrency(r.invoice?.totalAmount || 0)}
                              </span>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-7 text-[11px] gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => openResolveDialog(r)}
                              >
                                <Handshake className="h-3 w-3" />
                                Match Manually
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                                onClick={() => handleIgnore(r.id)}
                              >
                                Ignore
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>
        </motion.div>
      </motion.div>

      {/* ════════════════════════════════════════════
          4. Resolve Dialog
      ════════════════════════════════════════════ */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompareArrows className="h-5 w-5 text-emerald-600" />
              Resolve Mismatch
            </DialogTitle>
            <DialogDescription>
              Review the differences between your books and GSTR-2B data, then choose how to resolve.
            </DialogDescription>
          </DialogHeader>

          {selectedResult && (
            <div className="space-y-5">
              {/* Invoice Info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold">
                    {selectedResult.invoice?.invoiceNumber || 'Unknown Invoice'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedResult.invoice?.client?.tradeName || 'Unknown Client'} &middot;{' '}
                    {formatCurrency(selectedResult.invoice?.totalAmount || 0)}
                  </p>
                </div>
              </div>

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-2 gap-3">
                {/* Books side */}
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
                  <div className="flex items-center gap-1.5 mb-3">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-xs font-semibold text-emerald-800">
                      {selectedResult.sourceA || 'Books'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">GSTIN</span>
                      <span className="font-mono font-medium text-foreground">
                        {selectedResult.invoice?.sellerGstin || '—'}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Taxable</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(selectedResult.invoice?.taxableValue || 0)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">CGST</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(selectedResult.invoice?.cgst || 0)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">SGST</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(selectedResult.invoice?.sgst || 0)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-semibold text-emerald-800">
                        {formatCurrency(selectedResult.invoice?.totalAmount || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* GSTR-2B side */}
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Search className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-xs font-semibold text-amber-800">
                      {selectedResult.sourceB || 'GSTR-2B'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(() => {
                      const mm = parseMismatches(selectedResult.mismatches);
                      const gstMismatch = mm.find(m => m.field === 'gst_amount');
                      const totalMismatch = mm.find(m => m.field === 'total_amount');
                      const gstinMismatch = mm.find(m => m.field === 'vendor_gstin');
                      const dateMismatch = mm.find(m => m.field === 'invoice_date');

                      const altCgst = gstMismatch
                        ? Number(gstMismatch.actual) / 2
                        : selectedResult.invoice?.cgst || 0;
                      const altSgst = gstMismatch
                        ? Number(gstMismatch.actual) / 2
                        : selectedResult.invoice?.sgst || 0;
                      const altTotal = totalMismatch
                        ? Number(totalMismatch.actual)
                        : selectedResult.invoice?.totalAmount || 0;
                      const altGstin = gstinMismatch
                        ? String(gstinMismatch.actual)
                        : selectedResult.invoice?.sellerGstin || '—';

                      return (
                        <>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-muted-foreground">GSTIN</span>
                            <span className={`font-mono font-medium ${gstinMismatch ? 'text-amber-700' : 'text-foreground'}`}>
                              {altGstin}
                            </span>
                          </div>
                          <Separator />
                          <div className="flex justify-between text-[11px]">
                            <span className="text-muted-foreground">Taxable</span>
                            <span className="font-medium text-foreground">
                              {formatCurrency(selectedResult.invoice?.taxableValue || 0)}
                            </span>
                          </div>
                          <Separator />
                          <div className="flex justify-between text-[11px]">
                            <span className="text-muted-foreground">CGST</span>
                            <span className={`font-medium ${gstMismatch ? 'text-amber-700' : 'text-foreground'}`}>
                              {formatCurrency(altCgst)}
                            </span>
                          </div>
                          <Separator />
                          <div className="flex justify-between text-[11px]">
                            <span className="text-muted-foreground">SGST</span>
                            <span className={`font-medium ${gstMismatch ? 'text-amber-700' : 'text-foreground'}`}>
                              {formatCurrency(altSgst)}
                            </span>
                          </div>
                          <Separator />
                          <div className="flex justify-between text-[11px]">
                            <span className="text-muted-foreground">Total</span>
                            <span className={`font-semibold ${totalMismatch ? 'text-amber-800' : 'text-amber-800'}`}>
                              {formatCurrency(altTotal)}
                            </span>
                          </div>
                          {dateMismatch && (
                            <>
                              <Separator />
                              <div className="flex justify-between text-[11px]">
                                <span className="text-muted-foreground">Date</span>
                                <span className="font-medium text-amber-700">
                                  {String(dateMismatch.actual)}
                                </span>
                              </div>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* AI Recommendation */}
              {selectedResult.aiExplanation && (
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/30">
                  <div className="flex items-start gap-2.5">
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 shrink-0 mt-0.5">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-emerald-800">AI Recommendation</span>
                        <Badge variant="outline" className="h-4 text-[9px] border-emerald-200 bg-emerald-50 text-emerald-700">
                          {selectedResult.confidenceScore}% confidence
                        </Badge>
                      </div>
                      <p className="text-[11px] text-emerald-700 leading-relaxed">
                        {selectedResult.aiExplanation}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Resolution Options */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-foreground">Choose Resolution</Label>
                <RadioGroup
                  value={resolveChoice}
                  onValueChange={(v) => setResolveChoice(v as 'gstr2b' | 'books' | 'custom')}
                  className="gap-2"
                >
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors cursor-pointer">
                    <RadioGroupItem value="gstr2b" id="gstr2b" className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="gstr2b" className="text-xs font-semibold cursor-pointer">Accept GSTR-2B Value</Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Update your books to match the GST portal data. Recommended for minor discrepancies.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors cursor-pointer">
                    <RadioGroupItem value="books" id="books" className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="books" className="text-xs font-semibold cursor-pointer">Accept Books Value</Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Keep your books as-is. Use when the GST portal data appears incorrect.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors cursor-pointer">
                    <RadioGroupItem value="custom" id="custom" className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="custom" className="text-xs font-semibold cursor-pointer">Custom Value</Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Enter a custom amount. Use when neither source is fully correct.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setResolveDialogOpen(false)}
                  className="text-sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleResolve}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Save Resolution
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
