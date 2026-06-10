'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
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
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Play,
  Eye,
  Link2,
  Ban,
  ArrowRight,
  Clock,
  Search,
  ChevronDown,
  Activity,
  Target,
} from 'lucide-react';
import { formatCurrency } from '@/lib/gst-utils';
import { useApp } from '@/contexts/AppContext';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface ClientOption {
  id: string;
  tradeName: string;
  gstin: string;
}

interface InvoiceData {
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
}

interface ReconResult {
  id: string;
  clientId: string;
  invoiceId: string;
  matchStatus: string;
  matchScore: number;
  mismatches?: string;
  aiExplanation?: string;
  confidenceScore: number;
  workflowStatus: string;
  resolved: boolean;
  sourceA?: string;
  sourceB?: string;
  sourceGstin?: string;
  matchedGstin?: string;
  createdAt: string;
  invoice?: InvoiceData & { client?: { id: string; tradeName: string; gstin: string } };
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
// Constants
// ──────────────────────────────────────────────
const PERIODS = [
  '2026-03', '2026-02', '2026-01',
  '2025-12', '2025-11', '2025-10',
];

const SOURCE_OPTIONS = [
  { value: 'GSTR-1,GSTR-2A', label: 'GSTR-1 vs GSTR-2A' },
  { value: 'GSTR-1,GSTR-2B', label: 'GSTR-1 vs GSTR-2B' },
];

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function parseMismatches(raw?: string | null) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function getMatchRateColor(rate: number) {
  if (rate >= 90) return 'text-emerald-600';
  if (rate >= 70) return 'text-amber-600';
  return 'text-red-600';
}

function getMatchRateStroke(rate: number) {
  if (rate >= 90) return '#10b981';
  if (rate >= 70) return '#f59e0b';
  return '#ef4444';
}

function getMatchRateBg(rate: number) {
  if (rate >= 90) return 'bg-emerald-50';
  if (rate >= 70) return 'bg-amber-50';
  return 'bg-red-50';
}

function getMismatchType(result: ReconResult): string {
  const status = result.matchStatus;
  if (status === 'missing_in_gstr') return 'Missing in 2A/2B';
  if (status === 'missing_in_books') return 'Missing in GSTR-1';
  const mm = parseMismatches(result.mismatches);
  if (mm.some((m: { field: string }) => m.field === 'vendor_gstin')) return 'GSTIN Mismatch';
  if (mm.some((m: { field: string }) => m.field === 'gst_amount' || m.field === 'total_amount')) return 'Amount Mismatch';
  return 'Other Mismatch';
}

function getMismatchBadge(mismatchType: string) {
  switch (mismatchType) {
    case 'Amount Mismatch':
      return { variant: 'outline' as const, className: 'border-amber-200 bg-amber-50 text-amber-700' };
    case 'GSTIN Mismatch':
      return { variant: 'outline' as const, className: 'border-orange-200 bg-orange-50 text-orange-700' };
    case 'Missing in 2A/2B':
      return { variant: 'outline' as const, className: 'border-purple-200 bg-purple-50 text-purple-700' };
    case 'Missing in GSTR-1':
      return { variant: 'outline' as const, className: 'border-rose-200 bg-rose-50 text-rose-700' };
    default:
      return { variant: 'outline' as const, className: 'border-slate-200 bg-slate-50 text-slate-700' };
  }
}

function formatPeriod(period: string) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [year, month] = period.split('-').map(Number);
  return `${months[month - 1]} ${year}`;
}

// ──────────────────────────────────────────────
// Circular Progress Component
// ──────────────────────────────────────────────
function CircularProgress({ value, size = 120, strokeWidth = 8 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = getMatchRateStroke(value);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
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
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${getMatchRateColor(value)}`}>
          {value}%
        </span>
        <span className="text-[10px] text-muted-foreground">matched</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Animation Variants
// ──────────────────────────────────────────────
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const rowVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25 } },
};

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
export default function ReconciliationPage() {
  const { selectedClientId, setSelectedClientId } = useApp();

  // ── Data ──
  const [results, setResults] = useState<ReconResult[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [runs, setRuns] = useState<ReconRun[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);

  // ── Loading ──
  const [loading, setLoading] = useState(true);
  const [runningRecon, setRunningRecon] = useState(false);
  const [reconProgress, setReconProgress] = useState(0);

  // ── Filters ──
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterMismatchType, setFilterMismatchType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Dialogs ──
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ReconResult | null>(null);

  // ── Run Config ──
  const [runClient, setRunClient] = useState<string>('all');
  const [runPeriod, setRunPeriod] = useState('2026-03');
  const [runSource, setRunSource] = useState('GSTR-1,GSTR-2A');

  // ── Resolve Form ──
  const [resolveChoice, setResolveChoice] = useState<'gstr1' | 'gstr2a' | 'custom'>('gstr1');
  const [customAmount, setCustomAmount] = useState('');
  const [resolveNotes, setResolveNotes] = useState('');

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
      }
    } catch (err) {
      console.error('Error fetching results:', err);
    }
  }, [selectedClientId]);

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams({ action: 'stats' });
      if (selectedClientId) params.set('clientId', selectedClientId);
      const res = await fetch(`/api/reconciliation?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, [selectedClientId]);

  const fetchRuns = useCallback(async () => {
    try {
      const params = new URLSearchParams({ action: 'runs' });
      if (selectedClientId) params.set('clientId', selectedClientId);
      const res = await fetch(`/api/reconciliation?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch (err) {
      console.error('Error fetching runs:', err);
    }
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
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    }
  }, []);

  // ── Initial Load ──
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      await Promise.all([fetchResults(), fetchStats(), fetchRuns(), fetchClients()]);
      setLoading(false);
    }
    loadAll();
  }, [fetchResults, fetchStats, fetchRuns, fetchClients]);

  // ── Refetch on client change ──
  useEffect(() => {
    if (!loading) {
      fetchResults();
      fetchStats();
      fetchRuns();
    }
  }, [selectedClientId]);

  // ──────────────────────────────────────────
  // Computed Values
  // ──────────────────────────────────────────
  const summary = useMemo(() => {
    if (stats) {
      const matched = stats.matchBreakdown?.perfect_match ?? 0;
      const mismatched =
        (stats.matchBreakdown?.partial_match ?? 0) +
        (stats.matchBreakdown?.mismatch ?? 0);
      const unmatched =
        (stats.matchBreakdown?.missing_in_books ?? 0) +
        (stats.matchBreakdown?.missing_in_gstr ?? 0) +
        (stats.matchBreakdown?.unmatched ?? 0) +
        (stats.matchBreakdown?.duplicate ?? 0);
      return {
        total: stats.totalResults,
        matched,
        mismatched,
        unmatched,
        matchRate: stats.matchPercentage ?? (stats.totalResults > 0 ? Math.round((matched / stats.totalResults) * 100) : 0),
        gstDifference: stats.totalGstDifference ?? 0,
      };
    }
    const total = results.length;
    const matched = results.filter(r => r.matchStatus === 'perfect_match').length;
    const mismatched = results.filter(r => r.matchStatus === 'partial_match' || r.matchStatus === 'mismatch').length;
    const unmatched = results.filter(r =>
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
      gstDifference: 0,
    };
  }, [stats, results]);

  const pieData = useMemo(() => [
    { name: 'Matched', value: summary.matched },
    { name: 'Mismatched', value: summary.mismatched },
    { name: 'Unmatched', value: summary.unmatched },
  ], [summary]);

  // Client-wise summary
  const clientSummary = useMemo(() => {
    const map = new Map<string, { name: string; total: number; matched: number; mismatched: number; unmatched: number }>();
    for (const r of results) {
      const clientName = r.invoice?.client?.tradeName || 'Unknown';
      const key = r.clientId;
      if (!map.has(key)) {
        map.set(key, { name: clientName, total: 0, matched: 0, mismatched: 0, unmatched: 0 });
      }
      const entry = map.get(key)!;
      entry.total++;
      if (r.matchStatus === 'perfect_match') entry.matched++;
      else if (r.matchStatus === 'partial_match' || r.matchStatus === 'mismatch') entry.mismatched++;
      else entry.unmatched++;
    }
    return Array.from(map.values());
  }, [results]);

  // Mismatch results
  const mismatchResults = useMemo(() => {
    return results.filter(r =>
      r.matchStatus === 'partial_match' ||
      r.matchStatus === 'mismatch'
    ).filter(r => {
      if (filterClient !== 'all' && r.clientId !== filterClient) return false;
      if (filterMismatchType !== 'all' && getMismatchType(r) !== filterMismatchType) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const invNum = r.invoice?.invoiceNumber?.toLowerCase() ?? '';
        const gstin = r.sourceGstin?.toLowerCase() ?? '';
        if (!invNum.includes(q) && !gstin.includes(q)) return false;
      }
      return true;
    });
  }, [results, filterClient, filterMismatchType, searchQuery]);

  // Unmatched results
  const unmatchedResults = useMemo(() => {
    return results.filter(r =>
      r.matchStatus === 'missing_in_books' ||
      r.matchStatus === 'missing_in_gstr' ||
      r.matchStatus === 'unmatched' ||
      r.matchStatus === 'duplicate'
    ).filter(r => {
      if (filterClient !== 'all' && r.clientId !== filterClient) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const invNum = r.invoice?.invoiceNumber?.toLowerCase() ?? '';
        const gstin = r.sourceGstin?.toLowerCase() ?? '';
        if (!invNum.includes(q) && !gstin.includes(q)) return false;
      }
      return true;
    });
  }, [results, filterClient, searchQuery]);

  // ──────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────
  const handleRunReconciliation = async () => {
    setRunningRecon(true);
    setReconProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setReconProgress(prev => {
        if (prev >= 90) { clearInterval(progressInterval); return 90; }
        return prev + Math.random() * 15;
      });
    }, 400);

    try {
      const clientId = runClient === 'all' ? selectedClientId : runClient;
      if (!clientId) {
        clearInterval(progressInterval);
        setRunningRecon(false);
        return;
      }
      const res = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run',
          clientId,
          period: runPeriod,
          sources: runSource,
        }),
      });
      if (res.ok) {
        clearInterval(progressInterval);
        setReconProgress(100);
        await new Promise(r => setTimeout(r, 500));
        await Promise.all([fetchResults(), fetchStats(), fetchRuns()]);
      }
    } catch (err) {
      console.error('Error running reconciliation:', err);
    } finally {
      clearInterval(progressInterval);
      setRunningRecon(false);
      setReconProgress(0);
      setRunDialogOpen(false);
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
      setResolveNotes('');
      setCustomAmount('');
      setResolveChoice('gstr1');
      await fetchStats();
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
      await fetchStats();
    } catch (err) {
      console.error('Error ignoring:', err);
    }
  };

  // ──────────────────────────────────────────
  // Render: Skeleton Loader
  // ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-40 bg-muted animate-pulse rounded-lg" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded-lg mt-2" />
          </div>
          <div className="h-10 w-48 bg-muted animate-pulse rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1440px] mx-auto">
      {/* ════════════════════════════════════════════
          1. Header
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
            Match invoices, find discrepancies, stay compliant
          </p>
        </div>
        <Button
          onClick={() => setRunDialogOpen(true)}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
        >
          <Play className="h-4 w-4" />
          Run Reconciliation
        </Button>
      </motion.div>

      {/* ════════════════════════════════════════════
          2. Summary Cards
      ════════════════════════════════════════════ */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* Match Rate Card */}
        <motion.div variants={cardVariants}>
          <Card className="hover:shadow-md transition-shadow h-full">
            <CardContent className="p-6 flex items-center gap-5">
              <CircularProgress value={summary.matchRate} size={100} strokeWidth={8} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Match Rate</p>
                <p className="text-2xl font-bold mt-1">{summary.matchRate}%</p>
                <div className="flex items-center gap-1 mt-1">
                  <div className={`h-1.5 w-1.5 rounded-full ${summary.matchRate >= 90 ? 'bg-emerald-500' : summary.matchRate >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} />
                  <span className="text-[11px] text-muted-foreground">
                    {summary.matchRate >= 90 ? 'Excellent' : summary.matchRate >= 70 ? 'Needs attention' : 'Critical'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Matched Card */}
        <motion.div variants={cardVariants}>
          <Card className="hover:shadow-md transition-shadow h-full">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald-50">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Matched</p>
                  <p className="text-2xl font-bold text-emerald-700">{summary.matched}</p>
                </div>
              </div>
              <div className="mt-3">
                <Progress
                  value={summary.total > 0 ? (summary.matched / summary.total) * 100 : 0}
                  className="h-1.5 [&>div]:bg-emerald-500"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {summary.total > 0 ? Math.round((summary.matched / summary.total) * 100) : 0}% of total
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Mismatches Card */}
        <motion.div variants={cardVariants}>
          <Card className="hover:shadow-md transition-shadow h-full">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-amber-50">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Mismatches</p>
                  <p className="text-2xl font-bold text-amber-700">{summary.mismatched}</p>
                </div>
              </div>
              <div className="mt-3">
                <Progress
                  value={summary.total > 0 ? (summary.mismatched / summary.total) * 100 : 0}
                  className="h-1.5 [&>div]:bg-amber-500"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {summary.total > 0 ? Math.round((summary.mismatched / summary.total) * 100) : 0}% of total
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Unmatched Card */}
        <motion.div variants={cardVariants}>
          <Card className="hover:shadow-md transition-shadow h-full">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-red-50">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Unmatched</p>
                  <p className="text-2xl font-bold text-red-700">{summary.unmatched}</p>
                </div>
              </div>
              <div className="mt-3">
                <Progress
                  value={summary.total > 0 ? (summary.unmatched / summary.total) * 100 : 0}
                  className="h-1.5 [&>div]:bg-red-500"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {summary.total > 0 ? Math.round((summary.unmatched / summary.total) * 100) : 0}% of total
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* ════════════════════════════════════════════
          3. Main Content Tabs
      ════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-muted/60">
            <TabsTrigger value="overview" className="gap-1.5 text-sm">
              <Activity className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="mismatches" className="gap-1.5 text-sm">
              <AlertTriangle className="h-3.5 w-3.5" />
              Mismatches
              {summary.mismatched > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-amber-100 text-amber-700">
                  {summary.mismatched}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="unmatched" className="gap-1.5 text-sm">
              <XCircle className="h-3.5 w-3.5" />
              Unmatched
              {summary.unmatched > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-red-100 text-red-700">
                  {summary.unmatched}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ─── Overview Tab ─── */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Pie Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Match Distribution</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center pb-6">
                  <div className="w-full max-w-[260px]">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                          animationBegin={0}
                          animationDuration={800}
                        >
                          {pieData.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} stroke="none" />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: number, name: string) => [`${value} invoices`, name]}
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex items-center justify-center gap-4 mt-2">
                      {pieData.map((entry, i) => (
                        <div key={entry.name} className="flex items-center gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                          <span className="text-[11px] text-muted-foreground">{entry.name} ({entry.value})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Client-wise Summary Table */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Client-wise Reconciliation</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[320px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs">Client</TableHead>
                          <TableHead className="text-xs text-right">Total</TableHead>
                          <TableHead className="text-xs text-right">Matched</TableHead>
                          <TableHead className="text-xs text-right">Mismatched</TableHead>
                          <TableHead className="text-xs text-right">Unmatched</TableHead>
                          <TableHead className="text-xs text-right">Rate</TableHead>
                          <TableHead className="text-xs text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clientSummary.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                              No reconciliation data yet. Run reconciliation to get started.
                            </TableCell>
                          </TableRow>
                        ) : (
                          clientSummary.map((c, idx) => {
                            const rate = c.total > 0 ? Math.round((c.matched / c.total) * 100) : 0;
                            return (
                              <motion.tr
                                key={idx}
                                variants={rowVariants}
                                initial="hidden"
                                animate="visible"
                                transition={{ delay: idx * 0.04 }}
                                className="hover:bg-accent/40 transition-colors"
                              >
                                <TableCell className="font-medium text-sm">{c.name}</TableCell>
                                <TableCell className="text-sm text-right">{c.total}</TableCell>
                                <TableCell className="text-sm text-right text-emerald-700">{c.matched}</TableCell>
                                <TableCell className="text-sm text-right text-amber-700">{c.mismatched}</TableCell>
                                <TableCell className="text-sm text-right text-red-700">{c.unmatched}</TableCell>
                                <TableCell className="text-right">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      rate >= 90
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                        : rate >= 70
                                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                                        : 'border-red-200 bg-red-50 text-red-700'
                                    }`}
                                  >
                                    {rate}%
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                                    onClick={() => {
                                      const client = clients.find(cl => cl.tradeName === c.name);
                                      if (client) setSelectedClientId(client.id);
                                    }}
                                  >
                                    <Eye className="h-3 w-3" />
                                    View
                                  </Button>
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
            </div>

            {/* Recent Runs */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Recent Reconciliation Runs</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[240px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs">Period</TableHead>
                        <TableHead className="text-xs">Sources</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                        <TableHead className="text-xs text-right">Matched</TableHead>
                        <TableHead className="text-xs text-right">Unmatched</TableHead>
                        <TableHead className="text-xs text-right">GST Diff</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Ran At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                            No reconciliation runs yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        runs.slice(0, 10).map((run, idx) => (
                          <motion.tr
                            key={run.id}
                            variants={rowVariants}
                            initial="hidden"
                            animate="visible"
                            transition={{ delay: idx * 0.04 }}
                            className="hover:bg-accent/40 transition-colors"
                          >
                            <TableCell className="font-medium text-sm">{formatPeriod(run.period)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{run.sources}</TableCell>
                            <TableCell className="text-sm text-right">{run.totalRecords}</TableCell>
                            <TableCell className="text-sm text-right text-emerald-700">{run.matched}</TableCell>
                            <TableCell className="text-sm text-right text-red-700">{run.unmatched}</TableCell>
                            <TableCell className="text-sm text-right">{formatCurrency(run.gstDifference)}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  run.status === 'completed'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]'
                                    : 'border-amber-200 bg-amber-50 text-amber-700 text-[10px]'
                                }
                              >
                                {run.status === 'completed' ? 'Completed' : run.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(run.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </TableCell>
                          </motion.tr>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Mismatches Tab ─── */}
          <TabsContent value="mismatches" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search invoices..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <Select value={filterClient} onValueChange={setFilterClient}>
                    <SelectTrigger className="w-full sm:w-[180px] h-9">
                      <SelectValue placeholder="All Clients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.tradeName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterMismatchType} onValueChange={setFilterMismatchType}>
                    <SelectTrigger className="w-full sm:w-[180px] h-9">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="Amount Mismatch">Amount Mismatch</SelectItem>
                      <SelectItem value="GSTIN Mismatch">GSTIN Mismatch</SelectItem>
                      <SelectItem value="Missing in 2A/2B">Missing in 2A/2B</SelectItem>
                      <SelectItem value="Missing in GSTR-1">Missing in GSTR-1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Mismatches Table */}
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs">Invoice #</TableHead>
                        <TableHead className="text-xs">Client</TableHead>
                        <TableHead className="text-xs">Seller GSTIN</TableHead>
                        <TableHead className="text-xs text-right">GSTR-1 Amount</TableHead>
                        <TableHead className="text-xs text-right">GSTR-2A Amount</TableHead>
                        <TableHead className="text-xs text-right">Difference</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mismatchResults.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-300" />
                            <p className="text-sm font-medium">No mismatches found</p>
                            <p className="text-xs mt-1">All invoices are perfectly matched!</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        mismatchResults.map((r, idx) => {
                          const mm = parseMismatches(r.mismatches);
                          const amountMismatch = mm.find((m: { field: string }) => m.field === 'gst_amount' || m.field === 'total_amount');
                          const gstr1Amount = r.invoice?.totalAmount ?? 0;
                          const gstr2aAmount = amountMismatch
                            ? (amountMismatch.expected as number) === gstr1Amount
                              ? (amountMismatch.actual as number)
                              : (amountMismatch.expected as number)
                            : gstr1Amount;
                          const difference = Math.abs(gstr1Amount - gstr2aAmount);
                          const mismatchType = getMismatchType(r);
                          const badgeConfig = getMismatchBadge(mismatchType);

                          return (
                            <motion.tr
                              key={r.id}
                              variants={rowVariants}
                              initial="hidden"
                              animate="visible"
                              transition={{ delay: idx * 0.02 }}
                              className="hover:bg-accent/40 transition-colors"
                            >
                              <TableCell className="font-medium text-sm font-mono">
                                {r.invoice?.invoiceNumber ?? '—'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {r.invoice?.client?.tradeName ?? '—'}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground">
                                {r.sourceGstin ?? '—'}
                              </TableCell>
                              <TableCell className="text-sm text-right">{formatCurrency(gstr1Amount)}</TableCell>
                              <TableCell className="text-sm text-right">{formatCurrency(gstr2aAmount)}</TableCell>
                              <TableCell className="text-sm text-right font-medium text-red-600">
                                {difference > 0 ? formatCurrency(difference) : '—'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={badgeConfig.variant} className={`text-[10px] ${badgeConfig.className}`}>
                                  {mismatchType}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                                  onClick={() => {
                                    setSelectedResult(r);
                                    setResolveChoice('gstr1');
                                    setCustomAmount('');
                                    setResolveNotes('');
                                    setResolveDialogOpen(true);
                                  }}
                                  disabled={r.resolved}
                                >
                                  <Target className="h-3 w-3" />
                                  {r.resolved ? 'Resolved' : 'Resolve'}
                                </Button>
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
          </TabsContent>

          {/* ─── Unmatched Tab ─── */}
          <TabsContent value="unmatched" className="space-y-4">
            {/* Filter */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search invoices..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <Select value={filterClient} onValueChange={setFilterClient}>
                    <SelectTrigger className="w-full sm:w-[180px] h-9">
                      <SelectValue placeholder="All Clients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.tradeName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Unmatched Table */}
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs">Invoice #</TableHead>
                        <TableHead className="text-xs">Client</TableHead>
                        <TableHead className="text-xs">GSTIN</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                        <TableHead className="text-xs">Source</TableHead>
                        <TableHead className="text-xs">Period</TableHead>
                        <TableHead className="text-xs text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unmatchedResults.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-300" />
                            <p className="text-sm font-medium">No unmatched invoices</p>
                            <p className="text-xs mt-1">All invoices have been matched or are mismatches!</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        unmatchedResults.map((r, idx) => {
                          const source = r.matchStatus === 'missing_in_gstr'
                            ? 'GSTR-1 only'
                            : r.matchStatus === 'missing_in_books'
                            ? 'GSTR-2A/2B only'
                            : 'GSTR-1';
                          return (
                            <motion.tr
                              key={r.id}
                              variants={rowVariants}
                              initial="hidden"
                              animate="visible"
                              transition={{ delay: idx * 0.02 }}
                              className="hover:bg-accent/40 transition-colors"
                            >
                              <TableCell className="font-medium text-sm font-mono">
                                {r.invoice?.invoiceNumber ?? '—'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {r.invoice?.client?.tradeName ?? '—'}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground">
                                {r.sourceGstin ?? '—'}
                              </TableCell>
                              <TableCell className="text-sm text-right">
                                {formatCurrency(r.invoice?.totalAmount ?? 0)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] border-slate-200 bg-slate-50 text-slate-700">
                                  {source}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {r.invoice?.invoiceDate
                                  ? new Date(r.invoice.invoiceDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                                  : '—'}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                                    onClick={() => {
                                      setSelectedResult(r);
                                      setResolveChoice('gstr1');
                                      setCustomAmount('');
                                      setResolveNotes('');
                                      setResolveDialogOpen(true);
                                    }}
                                  >
                                    <Link2 className="h-3 w-3" />
                                    Link
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                    onClick={() => handleIgnore(r.id)}
                                    disabled={r.workflowStatus === 'ignored'}
                                  >
                                    <Ban className="h-3 w-3" />
                                    {r.workflowStatus === 'ignored' ? 'Ignored' : 'Ignore'}
                                  </Button>
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
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* ════════════════════════════════════════════
          Resolve Dialog
      ════════════════════════════════════════════ */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="sm:max-w-[580px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-600" />
              Resolve Mismatch
            </DialogTitle>
            <DialogDescription>
              Review both sides and choose the correct amount to proceed with.
            </DialogDescription>
          </DialogHeader>

          {selectedResult && (
            <div className="space-y-4">
              {/* Invoice Info */}
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium">
                  Invoice: {selectedResult.invoice?.invoiceNumber ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Client: {selectedResult.invoice?.client?.tradeName ?? '—'} &middot;{' '}
                  Seller GSTIN: {selectedResult.sourceGstin ?? '—'}
                </p>
              </div>

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">GSTR-1 (Books)</p>
                  <p className="text-lg font-bold">{formatCurrency(selectedResult.invoice?.totalAmount ?? 0)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Tax: {formatCurrency(
                      (selectedResult.invoice?.cgst ?? 0) +
                      (selectedResult.invoice?.sgst ?? 0) +
                      (selectedResult.invoice?.igst ?? 0)
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1">GSTR-2A/2B (Portal)</p>
                  {(() => {
                    const mm = parseMismatches(selectedResult.mismatches);
                    const amountMM = mm.find((m: { field: string }) => m.field === 'gst_amount' || m.field === 'total_amount');
                    const portalAmount = amountMM
                      ? (amountMM.expected as number) === (selectedResult.invoice?.totalAmount ?? 0)
                        ? (amountMM.actual as number)
                        : (amountMM.expected as number)
                      : selectedResult.invoice?.totalAmount ?? 0;
                    return (
                      <>
                        <p className="text-lg font-bold">{formatCurrency(portalAmount)}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Diff: {formatCurrency(Math.abs((selectedResult.invoice?.totalAmount ?? 0) - portalAmount))}
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Mismatch details */}
              {parseMismatches(selectedResult.mismatches).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Discrepancy Details</p>
                  {parseMismatches(selectedResult.mismatches).map((m: { field: string; expected: string | number; actual: string | number; difference?: number }, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs rounded border px-3 py-2 bg-muted/30">
                      <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                      <span className="font-medium capitalize">{m.field.replace(/_/g, ' ')}</span>
                      <span className="text-muted-foreground">:</span>
                      <span className="text-emerald-700">{String(m.expected)}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="text-amber-700">{String(m.actual)}</span>
                      {m.difference && (
                        <Badge variant="outline" className="text-[9px] border-red-200 bg-red-50 text-red-700 ml-auto">
                          Δ {m.difference}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              {/* Resolution Choice */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Accept which value?</Label>
                <RadioGroup value={resolveChoice} onValueChange={(v) => setResolveChoice(v as 'gstr1' | 'gstr2a' | 'custom')}>
                  <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/40 transition-colors cursor-pointer">
                    <RadioGroupItem value="gstr1" id="gstr1" />
                    <Label htmlFor="gstr1" className="cursor-pointer flex-1">
                      <span className="font-medium text-sm">Accept GSTR-1</span>
                      <span className="text-xs text-muted-foreground block">Use books value as source of truth</span>
                    </Label>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/40 transition-colors cursor-pointer">
                    <RadioGroupItem value="gstr2a" id="gstr2a" />
                    <Label htmlFor="gstr2a" className="cursor-pointer flex-1">
                      <span className="font-medium text-sm">Accept GSTR-2A/2B</span>
                      <span className="text-xs text-muted-foreground block">Use portal value as source of truth</span>
                    </Label>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/40 transition-colors cursor-pointer">
                    <RadioGroupItem value="custom" id="custom" />
                    <Label htmlFor="custom" className="cursor-pointer flex-1">
                      <span className="font-medium text-sm">Custom Amount</span>
                      <span className="text-xs text-muted-foreground block">Enter a corrected amount manually</span>
                    </Label>
                  </div>
                </RadioGroup>

                <AnimatePresence>
                  {resolveChoice === 'custom' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="pt-2">
                        <Label htmlFor="customAmount" className="text-xs">Corrected Amount (₹)</Label>
                        <Input
                          id="customAmount"
                          type="number"
                          placeholder="Enter amount"
                          value={customAmount}
                          onChange={e => setCustomAmount(e.target.value)}
                          className="mt-1.5 h-9"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="notes" className="text-xs">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add a note about this resolution..."
                  value={resolveNotes}
                  onChange={e => setResolveNotes(e.target.value)}
                  className="mt-1.5 min-h-[60px] text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════
          Run Reconciliation Dialog
      ════════════════════════════════════════════ */}
      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-emerald-600" />
              Run Reconciliation
            </DialogTitle>
            <DialogDescription>
              Select the client, period, and sources to match invoices.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Client */}
            <div>
              <Label className="text-sm">Client</Label>
              <Select value={runClient} onValueChange={setRunClient}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {selectedClientId ? 'Use Selected Client' : 'Select a client first'}
                  </SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.tradeName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Period */}
            <div>
              <Label className="text-sm">Period</Label>
              <Select value={runPeriod} onValueChange={setRunPeriod}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map(p => (
                    <SelectItem key={p} value={p}>{formatPeriod(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sources */}
            <div>
              <Label className="text-sm">Source Comparison</Label>
              <Select value={runSource} onValueChange={setRunSource}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Progress (shown during run) */}
            <AnimatePresence>
              {runningRecon && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Processing invoices...</span>
                    <span>{Math.round(reconProgress)}%</span>
                  </div>
                  <Progress value={reconProgress} className="h-2 [&>div]:bg-emerald-500" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setRunDialogOpen(false)}
              disabled={runningRecon}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRunReconciliation}
              disabled={runningRecon || (!selectedClientId && runClient === 'all')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 min-w-[160px]"
            >
              {runningRecon ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Start Reconciliation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
