'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  Loader2,
  GitCompareArrows,
  FileSpreadsheet,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ArrowRight,
  ChevronRight,
  Clock,
  Inbox,
  Zap,
  TrendingDown,
  BarChart3,
  Brain,
  X,
} from 'lucide-react';
import { formatCurrency } from '@/lib/gst-utils';
import { toast } from 'sonner';
import {
  createReconciliation,
  resolveMismatch,
  dismissRecommendation,
} from '@/lib/firestore-service';
import type {
  FirestoreReconciliation,
  FirestoreClient,
  FirestoreAIRecommendation,
  ReconMismatch,
} from '@/lib/firestore-schema';
import { MATCH_STATUS_CONFIG, RISK_LEVEL_CONFIG } from '@/types/gst';
import type { MatchStatus, RiskLevel } from '@/types/gst';
import { EmptyState } from '@/components/shared/EmptyState';

// ─── API response shapes (subset of Prisma models) ─────────────────────────

interface ApiReconciliationRun {
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
  runBy?: string | null;
  createdAt: string;
  results?: Array<{
    id: string;
    matchStatus: string;
    riskLevel: string;
    workflowStatus: string;
  }>;
}

interface ApiReconciliationResult {
  id: string;
  clientId: string;
  invoiceId: string;
  sourceType?: string;
  sourceA?: string | null;
  sourceB?: string | null;
  sourceGstin?: string | null;
  matchedGstin?: string | null;
  matchStatus: string;
  matchScore: number;
  mismatches?: string | null;
  aiExplanation?: string | null;
  aiRecommendation?: string | null;
  confidenceScore: number;
  workflowStatus: string;
  resolved: boolean;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  riskLevel: string;
  runId?: string | null;
  createdAt: string;
  updatedAt: string;
  invoice?: {
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    sellerGstin: string;
    buyerGstin?: string | null;
    totalAmount: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    taxableValue: number;
    client?: { id: string; tradeName: string; gstin: string } | null;
  } | null;
  run?: {
    id: string;
    period: string;
    sources: string;
    status: string;
    createdAt: string;
  } | null;
}

interface ApiClient {
  id: string;
  gstin: string;
  tradeName: string;
  legalName?: string | null;
  status: string;
  healthScore: number;
  createdAt: string;
  updatedAt: string;
  _aggregations?: {
    totalInvoices: number;
    filedReturns: number;
    pendingReturns: number;
    matchPercentage: number;
  };
}

// Maps a ReconciliationRun + its results to the FirestoreReconciliation shape used by the UI.
function mapApiRunToRecon(run: ApiReconciliationRun, results: ApiReconciliationResult[]): FirestoreReconciliation & { id: string } {
  const runResults = results.filter(r => r.runId === run.id);
  return {
    id: run.id,
    reconId: run.id,
    firmId: '',
    clientId: run.clientId,
    period: run.period,
    sources: run.sources,
    status: run.status as FirestoreReconciliation['status'],
    totalRecords: run.totalRecords ?? 0,
    matched: run.matched ?? 0,
    unmatched: run.unmatched ?? 0,
    partialMatches: run.partialMatches ?? 0,
    highRisk: run.highRisk ?? 0,
    gstDifference: run.gstDifference ?? 0,
    mismatches: runResults.map(mapApiResultToMismatch),
    runBy: run.runBy ?? null,
    createdAt: run.createdAt,
    updatedAt: run.createdAt,
  };
}

// Maps a ReconciliationResult row to the ReconMismatch shape used by the UI.
function mapApiResultToMismatch(r: ApiReconciliationResult): ReconMismatch {
  // Parse the JSON mismatches string to extract booksAmount, portalAmount, difference.
  let booksAmount = r.invoice?.totalAmount ?? 0;
  let portalAmount = 0;
  let difference = 0;
  if (r.mismatches) {
    try {
      const parsed = JSON.parse(r.mismatches);
      if (Array.isArray(parsed)) {
        for (const m of parsed) {
          if (m && typeof m === 'object') {
            const field = (m as { field?: string }).field;
            if (field === 'gst_amount' || field === 'total_amount') {
              const exp = Number((m as { expected?: number }).expected ?? 0);
              const act = Number((m as { actual?: number }).actual ?? 0);
              if (field === 'gst_amount') {
                // Books tax vs portal tax — use the GST amounts.
                booksAmount = exp;
                portalAmount = act;
                difference = Math.abs(exp - act);
              } else if (difference === 0) {
                booksAmount = exp;
                portalAmount = act;
                difference = Math.abs(exp - act);
              }
            }
          }
        }
      }
    } catch {
      // Ignore parse errors — fall back to invoice total.
    }
  }
  // If no mismatches and the result is a perfect match, both amounts equal the invoice total.
  if (r.matchStatus === 'perfect_match' && difference === 0) {
    portalAmount = booksAmount;
  }
  return {
    invoiceNumber: r.invoice?.invoiceNumber ?? '—',
    invoiceDate: r.invoice?.invoiceDate ?? '—',
    sourceGstin: r.sourceGstin ?? r.invoice?.sellerGstin ?? '—',
    matchedGstin: r.matchedGstin ?? null,
    matchStatus: r.matchStatus as MatchStatus,
    matchScore: r.matchScore ?? 0,
    booksAmount,
    portalAmount,
    difference,
    reason: r.aiExplanation ?? r.matchStatus,
    resolved: r.resolved ?? false,
    resolvedBy: r.resolvedBy ?? null,
    resolvedAt: r.resolvedAt ?? null,
  };
}

function mapApiClient(c: ApiClient): FirestoreClient & { id: string } {
  return {
    id: c.id,
    clientId: c.id,
    firmId: '',
    gstin: c.gstin,
    tradeName: c.tradeName,
    legalName: c.legalName ?? c.tradeName,
    address: null,
    state: null,
    stateCode: null,
    contactEmail: null,
    contactPhone: null,
    entityType: 'regular',
    returnPeriod: null,
    lastFilingDate: null,
    status: c.status as FirestoreClient['status'],
    healthScore: c.healthScore ?? 0,
    complianceProfile: {
      filingCompliance: 0,
      gstinValidity: true,
      lastFilingStatus: null,
      overdueReturns: c._aggregations?.pendingReturns ?? 0,
      totalReturnsFiled: c._aggregations?.filedReturns ?? 0,
      averageFilingDelay: 0,
    },
    invoiceCount: c._aggregations?.totalInvoices ?? 0,
    totalTaxPaid: 0,
    pendingReturnCount: c._aggregations?.pendingReturns ?? 0,
    documentCount: 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
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
// Source options for reconciliation
// ──────────────────────────────────────────────
const SOURCE_OPTIONS = [
  'GSTR-2B vs Purchase Register',
  'GSTR-1 vs Sales Register',
  'GSTR-2B vs GSTR-1',
  'Purchase Register vs Sales Register',
];

// ──────────────────────────────────────────────
// Period generator (last 12 months)
// ──────────────────────────────────────────────
function getRecentPeriods(count: number = 12): string[] {
  const periods: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    periods.push(`${yyyy}-${mm}`);
  }
  return periods;
}

function periodLabel(period: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [year, month] = period.split('-').map(Number);
  return `${months[month - 1]} ${year}`;
}

// ──────────────────────────────────────────────
// Summary Card
// ──────────────────────────────────────────────
function SummaryCard({
  title,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  subtitle?: string;
}) {
  return (
    <motion.div variants={cardEntrance}>
      <Card className="relative overflow-hidden border-border/60">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
              {subtitle && (
                <p className="text-[11px] text-muted-foreground">{subtitle}</p>
              )}
            </div>
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
              <Icon className={`h-4.5 w-4.5 ${iconColor}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ──────────────────────────────────────────────
// Match Rate Ring
// ──────────────────────────────────────────────
function MatchRateRing({
  matchPercent,
  partialPercent,
  size = 140,
  strokeWidth = 12,
}: {
  matchPercent: number;
  partialPercent: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const mismatchPercent = Math.max(0, 100 - matchPercent - partialPercent);

  const matchLen = (matchPercent / 100) * circumference;
  const partialLen = (partialPercent / 100) * circumference;
  const mismatchLen = (mismatchPercent / 100) * circumference;

  const partialOffset = -(matchLen);
  const mismatchOffset = -(matchLen + partialLen);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
        <defs>
          <filter id="ringGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {matchPercent > 0 && (
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#10b981"
            strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={`${matchLen} ${circumference - matchLen}`} strokeDashoffset={0}
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${matchLen} ${circumference - matchLen}` }}
            transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            filter="url(#ringGlow)"
          />
        )}
        {partialPercent > 0 && (
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f59e0b"
            strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={`${partialLen} ${circumference - partialLen}`} strokeDashoffset={partialOffset}
            initial={{ strokeDasharray: `0 ${circumference}`, strokeDashoffset: 0 }}
            animate={{ strokeDasharray: `${partialLen} ${circumference - partialLen}`, strokeDashoffset: partialOffset }}
            transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
            filter="url(#ringGlow)"
          />
        )}
        {mismatchPercent > 0 && (
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#ef4444"
            strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={`${mismatchLen} ${circumference - mismatchLen}`} strokeDashoffset={mismatchOffset}
            initial={{ strokeDasharray: `0 ${circumference}`, strokeDashoffset: 0 }}
            animate={{ strokeDasharray: `${mismatchLen} ${circumference - mismatchLen}`, strokeDashoffset: mismatchOffset }}
            transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.4 }}
            filter="url(#ringGlow)"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-bold tracking-tight text-foreground"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, duration: 0.4, type: 'spring' }}
        >
          {matchPercent}%
        </motion.span>
        <span className="text-[10px] font-medium text-muted-foreground">Match Rate</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
export default function ReconciliationPage() {
  // ── Real API-backed state (replaces former Firestore hooks) ─────────
  const [reconciliations, setReconciliations] = useState<(FirestoreReconciliation & { id: string })[]>([]);
  const [clients, setClients] = useState<(FirestoreClient & { id: string })[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<FirestoreAIRecommendation[]>([]);
  const [reconsLoading, setReconsLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [recsLoading, setRecsLoading] = useState(true);
  const [reconsError, setReconsError] = useState<string | null>(null);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setReconsLoading(true);
    // Fetch runs + results in parallel; results are used to populate per-run mismatches.
    Promise.all([
      fetch('/api/reconciliation?action=runs')
        .then(r => (r.ok ? r.json() : { runs: [] }))
        .catch(() => ({ runs: [] })),
      fetch('/api/reconciliation')
        .then(r => (r.ok ? r.json() : { results: [] }))
        .catch(() => ({ results: [] })),
    ])
      .then(([runsData, resultsData]) => {
        if (cancelled) return;
        const runs: ApiReconciliationRun[] = Array.isArray(runsData?.runs) ? runsData.runs : [];
        const results: ApiReconciliationResult[] = Array.isArray(resultsData?.results) ? resultsData.results : [];
        setReconciliations(runs.map(run => mapApiRunToRecon(run, results)));
        setReconsError(null);
        setReconsLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setReconsError(err instanceof Error ? err.message : 'Failed to load reconciliations');
        setReconsLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  useEffect(() => {
    let cancelled = false;
    setClientsLoading(true);
    fetch('/api/clients')
      .then(r => r.ok ? r.json() : { clients: [] })
      .then(data => {
        if (cancelled) return;
        const items: ApiClient[] = Array.isArray(data?.clients) ? data.clients : [];
        setClients(items.map(mapApiClient));
        setClientsError(null);
        setClientsLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setClients([]);
        setClientsError(err instanceof Error ? err.message : 'Failed to load clients');
        setClientsLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  // AI Recommendations have no backing REST API yet — leave the list empty so
  // the existing "No active recommendations" empty state renders truthfully.
  useEffect(() => {
    setAiRecommendations([]);
    setRecsError(null);
    setRecsLoading(false);
  }, []);

  const loading = reconsLoading || clientsLoading || recsLoading;

  // ── Dialog state ──
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [creating, setCreating] = useState(false);

  // ── Mismatch filter ──
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedReconId, setExpandedReconId] = useState<string | null>(null);
  const [resolvingInvoice, setResolvingInvoice] = useState<string | null>(null);
  const [dismissingRecId, setDismissingRecId] = useState<string | null>(null);

  // ── Client map ──
  const clientMap = useMemo(() => {
    const map = new Map<string, FirestoreClient & { id: string }>();
    for (const c of clients) {
      map.set(c.clientId, c);
    }
    return map;
  }, [clients]);

  // ── Aggregate stats ──
  const stats = useMemo(() => {
    let totalRuns = 0;
    let totalRecords = 0;
    let totalMatched = 0;
    let totalUnmatched = 0;
    let totalPartial = 0;
    let totalHighRisk = 0;
    let totalGstDiff = 0;

    for (const r of reconciliations) {
      totalRuns++;
      totalRecords += r.totalRecords;
      totalMatched += r.matched;
      totalUnmatched += r.unmatched;
      totalPartial += r.partialMatches;
      totalHighRisk += r.highRisk;
      totalGstDiff += Math.abs(r.gstDifference);
    }

    return { totalRuns, totalRecords, totalMatched, totalUnmatched, totalPartial, totalHighRisk, totalGstDiff };
  }, [reconciliations]);

  // ── All mismatches from all reconciliations (flattened) ──
  const allMismatches = useMemo(() => {
    const items: Array<ReconMismatch & { reconId: string; reconDocId: string; clientId: string; period: string }> = [];
    for (const r of reconciliations) {
      for (const m of r.mismatches) {
        items.push({ ...m, reconId: r.reconId, reconDocId: r.id, clientId: r.clientId, period: r.period });
      }
    }
    return items;
  }, [reconciliations]);

  // ── Filtered mismatches ──
  const filteredMismatches = useMemo(() => {
    if (filterStatus === 'all') return allMismatches;
    if (filterStatus === 'unresolved') return allMismatches.filter(m => !m.resolved);
    if (filterStatus === 'resolved') return allMismatches.filter(m => m.resolved);
    return allMismatches.filter(m => m.matchStatus === filterStatus);
  }, [allMismatches, filterStatus]);

  // ── Match rate calculation ──
  const matchPercent = stats.totalRecords > 0 ? Math.round((stats.totalMatched / stats.totalRecords) * 100) : 0;
  const partialPercent = stats.totalRecords > 0 ? Math.round((stats.totalPartial / stats.totalRecords) * 100) : 0;

  const isEmpty = reconciliations.length === 0 && !loading;

  // ── Active AI recommendations ──
  const activeRecommendations = useMemo(
    () => aiRecommendations.filter(r => r.status === 'active'),
    [aiRecommendations]
  );

  // ──────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────
  const handleCreateReconciliation = useCallback(async () => {
    if (!selectedClientId || !selectedPeriod || !selectedSource) {
      toast.error('Please select client, period, and source');
      return;
    }
    setCreating(true);
    try {
      await createReconciliation({
        clientId: selectedClientId,
        period: selectedPeriod,
        sources: selectedSource,
      });
      toast.success('Reconciliation run started successfully');
      setDialogOpen(false);
      setSelectedClientId('');
      setSelectedPeriod('');
      setSelectedSource('');
      setRefreshKey(k => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create reconciliation');
    } finally {
      setCreating(false);
    }
  }, [selectedClientId, selectedPeriod, selectedSource]);

  const handleResolveMismatch = useCallback(async (reconId: string, invoiceNumber: string) => {
    setResolvingInvoice(invoiceNumber);
    try {
      await resolveMismatch(reconId, invoiceNumber);
      toast.success(`Mismatch for invoice ${invoiceNumber} resolved`);
      setRefreshKey(k => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resolve mismatch');
    } finally {
      setResolvingInvoice(null);
    }
  }, []);

  const handleDismissRecommendation = useCallback(async (recId: string) => {
    setDismissingRecId(recId);
    try {
      await dismissRecommendation(recId);
      toast.success('Recommendation dismissed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to dismiss recommendation');
    } finally {
      setDismissingRecId(null);
    }
  }, []);

  // ──────────────────────────────────────────
  // Render: Loading
  // ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-[1440px] mx-auto">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-9 w-44 rounded-lg" />
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-6 py-4">
          <Skeleton className="h-[140px] w-[140px] rounded-full" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-1 w-full">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  // ──────────────────────────────────────────
  // Render: Error
  // ──────────────────────────────────────────
  if (reconsError || clientsError) {
    return (
      <div className="p-4 md:p-6 max-w-[1440px] mx-auto">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-800">
              Failed to load reconciliation data
            </p>
            <p className="text-xs text-red-600 mt-1">
              {reconsError || clientsError || 'Unknown error'}
            </p>
          </CardContent>
        </Card>
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
              Reconciliation Center
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Reconcile books with GST portal data
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                <Play className="h-4 w-4" />
                New Reconciliation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Reconciliation</DialogTitle>
                <DialogDescription>Select client, period, and data sources to start.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.clientId}>
                          {c.tradeName} — {c.gstin}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Period</Label>
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
                    <SelectContent>
                      {getRecentPeriods().map(p => (
                        <SelectItem key={p} value={p}>{periodLabel(p)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select value={selectedSource} onValueChange={setSelectedSource}>
                    <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                    <SelectContent>
                      {SOURCE_OPTIONS.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleCreateReconciliation}
                  disabled={creating || !selectedClientId || !selectedPeriod || !selectedSource}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Run Reconciliation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <EmptyState
          icon={GitCompareArrows}
          title="No reconciliations yet"
          description="Run your first reconciliation to compare your books with GST portal data and identify mismatches."
          action={{
            label: 'Run your first reconciliation',
            onClick: () => setDialogOpen(true),
            icon: Play,
          }}
        />
      </motion.div>
    );
  }

  // ──────────────────────────────────────────
  // Render: Main Content
  // ──────────────────────────────────────────
  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="p-4 md:p-6 max-w-[1440px] mx-auto space-y-5"
    >
      {/* ═══ HEADER ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Reconciliation Center
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Reconcile books with GST portal data
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
              <Play className="h-4 w-4" />
              New Reconciliation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Reconciliation</DialogTitle>
              <DialogDescription>Select client, period, and data sources to start.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.clientId}>
                        {c.tradeName} — {c.gstin}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Period</Label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
                  <SelectContent>
                    {getRecentPeriods().map(p => (
                      <SelectItem key={p} value={p}>{periodLabel(p)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Select value={selectedSource} onValueChange={setSelectedSource}>
                  <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleCreateReconciliation}
                disabled={creating || !selectedClientId || !selectedPeriod || !selectedSource}
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run Reconciliation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* ═══ SUMMARY CARDS + MATCH RING ═══ */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="flex flex-col md:flex-row items-center gap-6"
      >
        {/* Match Rate Ring */}
        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center justify-center">
            <MatchRateRing matchPercent={matchPercent} partialPercent={partialPercent} />
          </CardContent>
        </Card>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-1 w-full">
          <SummaryCard
            title="Total Runs"
            value={stats.totalRuns}
            icon={BarChart3}
            iconColor="text-slate-700"
            iconBg="bg-slate-100"
            subtitle="Reconciliation runs"
          />
          <SummaryCard
            title="Matched"
            value={stats.totalMatched}
            icon={CheckCircle2}
            iconColor="text-emerald-700"
            iconBg="bg-emerald-50"
            subtitle={`${matchPercent}% match rate`}
          />
          <SummaryCard
            title="Unmatched"
            value={stats.totalUnmatched}
            icon={XCircle}
            iconColor="text-red-700"
            iconBg="bg-red-50"
            subtitle={`${stats.totalHighRisk} high-risk`}
          />
          <SummaryCard
            title="ITC Difference"
            value={formatCurrency(stats.totalGstDiff)}
            icon={TrendingDown}
            iconColor="text-amber-700"
            iconBg="bg-amber-50"
            subtitle="Potential ITC loss"
          />
          <SummaryCard
            title="AI Insights"
            value={activeRecommendations.length}
            icon={Brain}
            iconColor="text-violet-700"
            iconBg="bg-violet-50"
            subtitle="Active recommendations"
          />
        </div>
      </motion.div>

      {/* ═══ MAIN CONTENT: Mismatch Table + AI Panel ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Mismatch Table */}
        <motion.div variants={slideInRight} initial="hidden" animate="visible" className="lg:col-span-2">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold">Mismatch Records</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {filteredMismatches.length} record{filteredMismatches.length !== 1 ? 's' : ''} found
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-8 w-[160px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="unresolved">Unresolved</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="mismatch">Mismatch</SelectItem>
                      <SelectItem value="partial_match">Partial Match</SelectItem>
                      <SelectItem value="missing_in_books">Missing in Books</SelectItem>
                      <SelectItem value="missing_in_gstr">Missing in GSTR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              {filteredMismatches.length === 0 ? (
                <div className="py-12 text-center">
                  <Inbox className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No mismatches found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {filterStatus !== 'all' ? 'Try adjusting the filter' : 'All records are matched'}
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[11px] font-medium">Invoice</TableHead>
                        <TableHead className="text-[11px] font-medium">Status</TableHead>
                        <TableHead className="text-[11px] font-medium text-right">Books Amount</TableHead>
                        <TableHead className="text-[11px] font-medium text-right">Portal Amount</TableHead>
                        <TableHead className="text-[11px] font-medium text-right">Difference</TableHead>
                        <TableHead className="text-[11px] font-medium">Reason</TableHead>
                        <TableHead className="text-[11px] font-medium text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {filteredMismatches.map((m, idx) => {
                          const statusConfig = MATCH_STATUS_CONFIG[m.matchStatus as MatchStatus];
                          return (
                            <motion.tr
                              key={`${m.reconId}-${m.invoiceNumber}-${idx}`}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.2, delay: idx * 0.02 }}
                              className="border-b border-border/40 hover:bg-muted/30 transition-colors"
                            >
                              <TableCell className="py-2.5">
                                <div>
                                  <p className="text-xs font-medium text-foreground">{m.invoiceNumber}</p>
                                  <p className="text-[10px] text-muted-foreground">{m.invoiceDate}</p>
                                </div>
                              </TableCell>
                              <TableCell className="py-2.5">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 ${statusConfig?.bgColor ?? 'bg-slate-50'} ${statusConfig?.color ?? 'text-slate-700'} border-0`}
                                >
                                  {statusConfig?.label ?? m.matchStatus}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2.5 text-right text-xs text-foreground">
                                {formatCurrency(m.booksAmount)}
                              </TableCell>
                              <TableCell className="py-2.5 text-right text-xs text-foreground">
                                {formatCurrency(m.portalAmount)}
                              </TableCell>
                              <TableCell className="py-2.5 text-right">
                                <span className={`text-xs font-semibold ${m.difference > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                  {m.difference > 0 ? '+' : ''}{formatCurrency(m.difference)}
                                </span>
                              </TableCell>
                              <TableCell className="py-2.5 text-xs text-muted-foreground max-w-[180px] truncate">
                                {m.reason}
                              </TableCell>
                              <TableCell className="py-2.5 text-right">
                                {m.resolved ? (
                                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 px-1.5 py-0">
                                    Resolved
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px] px-2 gap-1"
                                    disabled={resolvingInvoice === m.invoiceNumber}
                                    onClick={() => handleResolveMismatch(m.reconId, m.invoiceNumber)}
                                  >
                                    {resolvingInvoice === m.invoiceNumber ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-3 w-3" />
                                    )}
                                    Resolve
                                  </Button>
                                )}
                              </TableCell>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* AI Recommendations Panel */}
        <motion.div variants={slideInRight} initial="hidden" animate="visible" className="lg:col-span-1">
          <Card className="border-border/60 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
                  <Sparkles className="h-3.5 w-3.5 text-violet-700" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">AI Recommendations</CardTitle>
                  <CardDescription className="text-[11px]">
                    {activeRecommendations.length} active insight{activeRecommendations.length !== 1 ? 's' : ''}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {activeRecommendations.length === 0 ? (
                <div className="py-10 text-center">
                  <Sparkles className="h-6 w-6 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No active recommendations</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    AI insights will appear after reconciliation
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-96">
                  <div className="space-y-2.5">
                    <AnimatePresence>
                      {activeRecommendations.map((rec, idx) => {
                        const riskCfg = RISK_LEVEL_CONFIG[rec.riskLevel as RiskLevel];
                        return (
                          <motion.div
                            key={rec.id}
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -12 }}
                            transition={{ duration: 0.25, delay: idx * 0.04 }}
                            className="rounded-lg border border-border/60 p-3 hover:border-border transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] px-1 py-0 ${riskCfg?.bgColor ?? 'bg-slate-50'} ${riskCfg?.color ?? 'text-slate-700'} border-0`}
                                  >
                                    {riskCfg?.label ?? rec.riskLevel}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">
                                    {rec.confidenceScore}% confidence
                                  </span>
                                </div>
                                <p className="text-xs font-medium text-foreground leading-tight">
                                  {rec.title}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                                  {rec.description}
                                </p>
                                {rec.suggestedAction && (
                                  <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-700">
                                    <Zap className="h-3 w-3" />
                                    <span className="truncate">{rec.suggestedAction}</span>
                                  </div>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                                disabled={dismissingRecId === rec.id}
                                onClick={() => handleDismissRecommendation(rec.id)}
                              >
                                {dismissingRecId === rec.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ═══ RECONCILIATION RUNS HISTORY ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Reconciliation Runs</CardTitle>
            <CardDescription className="text-xs">
              {reconciliations.length} run{reconciliations.length !== 1 ? 's' : ''} completed
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {reconciliations.map((r, idx) => {
                  const client = clientMap.get(r.clientId);
                  const isExpanded = expandedReconId === r.id;
                  const runMatchPercent = r.totalRecords > 0 ? Math.round((r.matched / r.totalRecords) * 100) : 0;
                  const unresolvedCount = r.mismatches.filter(m => !m.resolved).length;

                  return (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.03 }}
                    >
                      <button
                        onClick={() => setExpandedReconId(isExpanded ? null : r.id)}
                        className="w-full text-left rounded-lg border border-border/60 hover:border-border hover:bg-muted/20 transition-colors p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                              r.status === 'completed' ? 'bg-emerald-50' : r.status === 'running' ? 'bg-amber-50' : 'bg-red-50'
                            }`}>
                              {r.status === 'completed' ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              ) : r.status === 'running' ? (
                                <Loader2 className="h-4 w-4 text-amber-600 animate-spin" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">
                                {client?.tradeName ?? 'Unknown Client'} — {periodLabel(r.period)}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {r.sources} &middot; {r.totalRecords} records &middot; {runMatchPercent}% match
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="hidden sm:flex items-center gap-4 text-[11px]">
                              <span className="text-emerald-700 font-medium">{r.matched} matched</span>
                              <span className="text-amber-700 font-medium">{r.partialMatches} partial</span>
                              <span className="text-red-700 font-medium">{r.unmatched} unmatched</span>
                              {unresolvedCount > 0 && (
                                <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 px-1.5 py-0">
                                  {unresolvedCount} unresolved
                                </Badge>
                              )}
                            </div>
                            <motion.div
                              animate={{ rotate: isExpanded ? 90 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </motion.div>
                          </div>
                        </div>
                      </button>

                      {/* Expanded detail */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="pl-11 pr-3 pt-2 pb-1 space-y-1.5">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                                <div className="rounded-md bg-emerald-50 border border-emerald-100 p-2">
                                  <p className="text-emerald-700 font-semibold">{r.matched}</p>
                                  <p className="text-emerald-600">Matched</p>
                                </div>
                                <div className="rounded-md bg-amber-50 border border-amber-100 p-2">
                                  <p className="text-amber-700 font-semibold">{r.partialMatches}</p>
                                  <p className="text-amber-600">Partial</p>
                                </div>
                                <div className="rounded-md bg-red-50 border border-red-100 p-2">
                                  <p className="text-red-700 font-semibold">{r.unmatched}</p>
                                  <p className="text-red-600">Unmatched</p>
                                </div>
                                <div className="rounded-md bg-orange-50 border border-orange-100 p-2">
                                  <p className="text-orange-700 font-semibold">{formatCurrency(Math.abs(r.gstDifference))}</p>
                                  <p className="text-orange-600">ITC Diff</p>
                                </div>
                              </div>
                              {r.highRisk > 0 && (
                                <div className="flex items-center gap-1.5 text-[11px] text-orange-700 bg-orange-50 rounded-md px-2 py-1.5">
                                  <ShieldAlert className="h-3 w-3" />
                                  <span>{r.highRisk} high-risk record{r.highRisk !== 1 ? 's' : ''} require attention</span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
