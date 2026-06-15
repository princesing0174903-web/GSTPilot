'use client';

import React, { useState, useMemo } from 'react';
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
  Inbox,
} from 'lucide-react';
import { formatCurrency, generateMismatchExplanation } from '@/lib/gst-utils';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';
import {
  useReconResults,
  useReconRuns,
  useReconStats,
  useClients,
  useCreateReconRun,
  useUpdateReconWorkflow,
  useActivities,
} from '@/hooks/api';
import type { ReconciliationResult, ReconciliationRun } from '@/types/gst';
import { EmptyState } from '@/components/shared/EmptyState';

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

// ─── Map API ReconciliationResult to local MismatchRecord ─────────────────
function mapReconResultToMismatch(
  result: ReconciliationResult,
  clientName: string
): MismatchRecord {
  // Parse mismatches JSON string
  let parsedMismatches: MismatchDetail[] = [];
  try {
    if (result.mismatches) {
      parsedMismatches = JSON.parse(result.mismatches);
    }
  } catch {
    parsedMismatches = [];
  }

  // Derive category from matchStatus
  const mismatchCategory =
    result.matchStatus === 'missing_in_gstr' ? 'missing_in_gstr' :
    result.matchStatus === 'missing_in_books' ? 'missing_in_books' :
    result.matchStatus === 'duplicate' ? 'duplicate' :
    parsedMismatches.some(m => m.field === 'vendor_gstin' || m.field === 'sellerGstin') ? 'gstin_mismatch' :
    'tax_difference';

  const mismatchType =
    result.matchStatus === 'perfect_match' ? 'Perfect Match' :
    result.matchStatus === 'partial_match' ? 'Partial Match' :
    result.matchStatus === 'missing_in_gstr' ? 'Missing in Portal' :
    result.matchStatus === 'missing_in_books' ? 'Missing in Books' :
    result.matchStatus === 'duplicate' ? 'Duplicate' :
    'Mismatch';

  // Compute tax difference from mismatch details
  const taxDiff = parsedMismatches.reduce((sum, m) => sum + (m.difference || 0), 0);

  // Extract diff fields for highlighting
  const diffFields = parsedMismatches.map(m => m.field);

  // Build booksData from invoice if available, else from mismatch details
  const booksTaxableValue = parsedMismatches.find(m => m.field === 'taxableValue')?.expected as number || 0;
  const portalTaxableValue = parsedMismatches.find(m => m.field === 'taxableValue')?.actual as number || 0;

  return {
    id: result.id,
    invoiceNumber: result.invoice?.invoiceNumber ?? result.sourceGstin ?? 'Unknown',
    clientName,
    mismatchCategory,
    mismatchType,
    taxDifference: Math.abs(taxDiff),
    confidenceScore: result.confidenceScore ?? 90,
    aiExplanation: result.aiExplanation ?? generateMismatchExplanation(diffFields),
    aiRecommendation: result.aiRecommendation ?? 'Review manually',
    booksData: {
      invoiceNumber: result.invoice?.invoiceNumber ?? '—',
      invoiceDate: result.invoice?.invoiceDate ?? '—',
      sellerGstin: result.sourceGstin ?? result.invoice?.sellerGstin ?? '—',
      buyerGstin: result.invoice?.buyerGstin ?? '—',
      taxableValue: booksTaxableValue || (result.invoice?.taxableValue ?? 0),
      cgst: result.invoice?.cgst ?? 0,
      sgst: result.invoice?.sgst ?? 0,
      igst: result.invoice?.igst ?? 0,
      totalAmount: result.invoice?.totalAmount ?? 0,
    },
    gstr2bData: result.matchStatus === 'missing_in_gstr' ? null : {
      invoiceNumber: result.matchedGstin ?? result.invoice?.invoiceNumber ?? '—',
      invoiceDate: result.invoice?.invoiceDate ?? '—',
      sellerGstin: result.matchedGstin ?? result.sourceGstin ?? '—',
      buyerGstin: '—',
      taxableValue: portalTaxableValue,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalAmount: portalTaxableValue,
    },
    diffFields,
    resolved: result.resolved,
    workflowStatus: result.workflowStatus,
  };
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
export default function ReconciliationPage() {
  const { selectedClientId, setCurrentView } = useApp();

  // ── React Query hooks ──
  const { data: clientsData, isLoading: clientsLoading } = useClients();
  const { data: reconResultsData, isLoading: resultsLoading } = useReconResults(
    selectedClientId ? { clientId: selectedClientId } : undefined
  );
  const { data: reconStatsData, isLoading: statsLoading } = useReconStats(selectedClientId ?? undefined);
  const { data: reconRunsData } = useReconRuns(selectedClientId ?? undefined);
  const { data: activitiesData } = useActivities(selectedClientId ?? undefined);

  // Mutations
  const createReconRunMutation = useCreateReconRun();
  const updateWorkflowMutation = useUpdateReconWorkflow();

  // ── Filters ──
  const [filterClient, setFilterClient] = useState<string>('all');
  const [activeCategory, setActiveCategory] = useState<MismatchCategory>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  // ── Build client options from API ──
  const clients: ClientOption[] = useMemo(() =>
    (clientsData?.clients ?? []).map(c => ({ id: c.id, tradeName: c.tradeName, gstin: c.gstin })),
    [clientsData]
  );

  // ── Client map for name lookups ──
  const clientMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clients) {
      map.set(c.id, c.tradeName);
    }
    return map;
  }, [clients]);

  // ── Determine active client ──
  const activeClientId = selectedClientId || (filterClient !== 'all' ? filterClient : null);

  // ── Build MismatchRecords from API recon results ──
  const apiResults = reconResultsData?.results ?? [];
  const mismatches: MismatchRecord[] = useMemo(() =>
    apiResults
      .filter(r => r.matchStatus !== 'perfect_match')
      .map(r => mapReconResultToMismatch(r, clientMap.get(r.clientId) ?? 'Unknown')),
    [apiResults, clientMap]
  );

  // ── Compute match counts from stats ──
  const stats = reconStatsData?.stats;
  const perfectMatchCount = stats?.matchBreakdown?.perfect_match ?? 0;
  const partialMatchCount = stats?.matchBreakdown?.partial_match ?? 0;

  // ── Timeline from recon runs ──
  const timeline: ReconTimelineEntry[] = useMemo(() => {
    const runs = reconRunsData?.runs ?? [];
    return runs.map(run => ({
      id: run.id,
      date: run.createdAt,
      clients: clientMap.get(run.clientId) ?? 'Unknown',
      recordsProcessed: run.totalRecords,
      matchRate: run.totalRecords > 0 ? Math.round((run.matched / run.totalRecords) * 100) : 0,
    }));
  }, [reconRunsData, clientMap]);

  // ── Loading ──
  const loading = clientsLoading || resultsLoading || statsLoading;
  const [runningRecon, setRunningRecon] = useState(false);

  // ── Selection ──
  const [selectedMismatchId, setSelectedMismatchId] = useState<string | null>(null);

  // ── Sidebar ──
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);

  // ──────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────
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

  const isEmpty = totalRecords === 0 && !loading;

  // ──────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────
  const handleRunReconciliation = async () => {
    const clientId = selectedClientId || (filterClient !== 'all' ? filterClient : null);
    if (!clientId) {
      toast.error('Select a client first to run reconciliation');
      return;
    }
    setRunningRecon(true);
    try {
      await createReconRunMutation.mutateAsync({
        clientId,
        period: '2025-06',
      });
      toast.success('Reconciliation run completed successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error running reconciliation');
    } finally {
      setRunningRecon(false);
    }
  };

  const handleAcceptGSTR2B = (id: string) => {
    updateWorkflowMutation.mutate(
      { id, workflowStatus: 'resolved' },
      {
        onSuccess: () => toast.success('Accepted GSTR-2B value — mismatch resolved'),
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const handleKeepBooks = (id: string) => {
    updateWorkflowMutation.mutate(
      { id, workflowStatus: 'resolved' },
      {
        onSuccess: () => toast.success('Kept books value — mismatch resolved'),
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const handleCustomResolution = (id: string) => {
    updateWorkflowMutation.mutate(
      { id, workflowStatus: 'under_review' },
      {
        onSuccess: () => toast.info('Marked for custom resolution — under review'),
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const handleAutoResolve = () => {
    const toResolve = mismatches.filter(m => !m.resolved && m.confidenceScore >= 93);
    if (toResolve.length === 0) {
      toast.info('No high-confidence mismatches to auto-resolve');
      return;
    }
    // Resolve each one
    for (const m of toResolve) {
      updateWorkflowMutation.mutate(
        { id: m.id, workflowStatus: 'resolved' },
        {
          onSuccess: () => {},
          onError: () => {},
        }
      );
    }
    toast.success(`Auto-resolving ${toResolve.length} mismatches with high confidence`);
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

        <EmptyState
          icon={GitCompareArrows}
          title="No reconciliations run yet"
          description="Run reconciliation to compare your books with GSTR-2B data."
          action={{
            label: 'Run Reconciliation',
            onClick: handleRunReconciliation,
            icon: Play,
          }}
        />
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
            disabled={updateWorkflowMutation.isPending}
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
                              disabled={updateWorkflowMutation.isPending}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Accept GSTR-2B
                            </Button>
                            <Button
                              onClick={() => handleKeepBooks(selectedMismatch.id)}
                              variant="secondary"
                              className="gap-1.5 flex-1"
                              size="sm"
                              disabled={updateWorkflowMutation.isPending}
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Keep Books Value
                            </Button>
                            <Button
                              onClick={() => handleCustomResolution(selectedMismatch.id)}
                              variant="outline"
                              className="gap-1.5 flex-1"
                              size="sm"
                              disabled={updateWorkflowMutation.isPending}
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
                  {timeline.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      No runs yet
                    </div>
                  ) : (
                    timeline.map((entry, i) => {
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
                    })
                  )}
                </div>
              </ScrollArea>
            )}
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
