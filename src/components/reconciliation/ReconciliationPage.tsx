'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Eye,
  Zap,
  ArrowRight,
  Shield,
  TrendingUp,
  HelpCircle,
  Database,
  ShieldAlert,
  IndianRupee,
  Download,
  MoreHorizontal,
  FileSpreadsheet,
  FileText,
  AlertOctagon,
  ClipboardList,
  ArrowUpRight,
  X,
  Clock,
  User,
  MessageSquare,
  Activity,
  Copy,
  ExternalLink,
} from 'lucide-react';
import type {
  ReconciliationResult,
  ReconciliationRun,
  MatchStatus,
  RiskLevel,
  WorkflowStatus,
  AIRecommendationType,
} from '@/types/gst';
import {
  MATCH_STATUS_CONFIG,
  RISK_LEVEL_CONFIG,
  WORKFLOW_STATUS_CONFIG,
  AI_RECOMMENDATION_CONFIG,
} from '@/types/gst';
import { formatCurrency } from '@/lib/gst-utils';
import { useApp } from '@/contexts/AppContext';

// ──────────────────────────────────────────────
// Static Data
// ──────────────────────────────────────────────
const TEAM_MEMBERS = [
  { id: 'tm1', name: 'Rahul Sharma' },
  { id: 'tm2', name: 'Priya Patel' },
  { id: 'tm3', name: 'Amit Kumar' },
  { id: 'tm4', name: 'Sneha Reddy' },
  { id: 'tm5', name: 'Vikram Singh' },
];

const PERIODS = [
  '2026-03',
  '2026-02',
  '2026-01',
  '2025-12',
  '2025-11',
  '2025-10',
];

const SOURCE_OPTIONS = [
  { value: 'Purchase Register,GSTR-2B', label: 'Purchase Register vs GSTR-2B' },
  { value: 'Sales Register,GSTR-1', label: 'Sales Register vs GSTR-1' },
  { value: 'Purchase Register,GSTR-3B', label: 'Purchase Register vs GSTR-3B' },
  { value: 'All Sources', label: 'All Sources' },
];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function parseMismatches(
  mismatches?: string | null
): { field: string; expected: string | number; actual: string | number; difference?: number }[] {
  if (!mismatches) return [];
  try {
    return JSON.parse(mismatches);
  } catch {
    return [];
  }
}

function formatFieldName(field: string): string {
  const map: Record<string, string> = {
    gst_amount: 'GST Amount',
    total_amount: 'Total Amount',
    tax: 'Tax Amount',
    cgst: 'CGST',
    sgst: 'SGST',
    igst: 'IGST',
    cess: 'Cess',
    taxableValue: 'Taxable Value',
    invoice_number: 'Invoice Number',
    invoice_date: 'Invoice Date',
    vendor_gstin: 'Vendor GSTIN',
  };
  return map[field] || field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function getConfidenceColor(score: number): string {
  if (score >= 80) return 'text-emerald-700';
  if (score >= 50) return 'text-amber-700';
  return 'text-red-700';
}

function getConfidenceBarColor(score: number): string {
  if (score >= 80) return '[&>div]:bg-emerald-500';
  if (score >= 50) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-red-500';
}

function getRiskLevelForResult(result: ReconciliationResult): RiskLevel {
  const inv = result.invoice;
  if (inv && inv.riskLevel) return inv.riskLevel as RiskLevel;
  return 'low';
}

function getAIRecConfig(rec?: string | null) {
  if (!rec) return null;
  if (rec in AI_RECOMMENDATION_CONFIG) {
    return AI_RECOMMENDATION_CONFIG[rec as AIRecommendationType];
  }
  return null;
}

function truncate(str: string, max: number) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

// ──────────────────────────────────────────────
// Types for local state
// ──────────────────────────────────────────────
interface ClientOption {
  id: string;
  tradeName: string;
  gstin: string;
}

interface StatsData {
  totalResults: number;
  matchBreakdown: Record<string, number>;
  unresolved: number;
  riskBreakdown: { high: number; critical: number; highAndCritical: number };
  workflowBreakdown: Record<string, number>;
  matchPercentage: number;
  riskPercentage: number;
  totalGstDifference: number;
  avgMatchScore: number;
  avgConfidenceScore: number;
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
export default function ReconciliationPage() {
  const { selectedClientId, setSelectedClientId } = useApp();

  // ── Data ──
  const [reconResults, setReconResults] = useState<ReconciliationResult[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [runs, setRuns] = useState<ReconciliationRun[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);

  // ── Loading States ──
  const [loading, setLoading] = useState(true);
  const [runningRecon, setRunningRecon] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ── Filters ──
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-03');
  const [selectedSource, setSelectedSource] = useState<string>('Purchase Register,GSTR-2B');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [filterWorkflow, setFilterWorkflow] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Detail Dialog ──
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ReconciliationResult | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  // ── Active Tab ──
  const [activeTab, setActiveTab] = useState('all');

  // ──────────────────────────────────────────
  // Data Fetching
  // ──────────────────────────────────────────
  const fetchResults = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedClientId) params.set('clientId', selectedClientId);
      if (filterStatus !== 'all') params.set('matchStatus', filterStatus);
      if (filterWorkflow !== 'all') params.set('workflowStatus', filterWorkflow);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/reconciliation?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReconResults(data.results || []);
      }
    } catch (err) {
      console.error('Error fetching reconciliation results:', err);
    }
  }, [selectedClientId, filterStatus, filterWorkflow, searchQuery]);

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
      await Promise.all([fetchResults(), fetchRuns(), fetchStats(), fetchClients()]);
      setLoading(false);
    }
    loadAll();
    }, []);

  // ── Refetch when filters change ──
  useEffect(() => {
    if (!loading) {
      fetchResults();
      fetchStats();
    }
  }, [selectedClientId, filterStatus, filterWorkflow, searchQuery]);

  // ──────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────
  const handleRunReconciliation = async () => {
    if (!selectedClientId) return;
    setRunningRecon(true);
    try {
      const res = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run',
          clientId: selectedClientId,
          period: selectedPeriod,
          sources: selectedSource,
        }),
      });
      if (res.ok) {
        await Promise.all([fetchResults(), fetchRuns(), fetchStats()]);
      }
    } catch (err) {
      console.error('Error running reconciliation:', err);
    } finally {
      setRunningRecon(false);
    }
  };

  const handleUpdateWorkflow = async (id: string, workflowStatus: WorkflowStatus) => {
    try {
      const res = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_workflow', id, workflowStatus }),
      });
      if (res.ok) {
        setReconResults((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, workflowStatus, resolved: workflowStatus === 'resolved' } : r
          )
        );
        if (selectedResult && selectedResult.id === id) {
          setSelectedResult((prev) =>
            prev ? { ...prev, workflowStatus, resolved: workflowStatus === 'resolved' } : null
          );
        }
        await fetchStats();
      }
    } catch (err) {
      console.error('Error updating workflow:', err);
    }
  };

  const handleExport = async (format: string) => {
    setExporting(true);
    try {
      const res = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export',
          format,
          clientId: selectedClientId || undefined,
          filters: {
            matchStatus: filterStatus !== 'all' ? filterStatus : undefined,
            riskLevel: filterRisk !== 'all' ? filterRisk : undefined,
            workflowStatus: filterWorkflow !== 'all' ? filterWorkflow : undefined,
            search: searchQuery || undefined,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data.export, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reconciliation-${format}-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Error exporting:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedResult) return;
    try {
      const res = await fetch('/api/reconciliation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedResult.id,
          resolvedBy: assignedTo || 'Current User',
        }),
      });
      if (res.ok) {
        setReconResults((prev) =>
          prev.map((r) =>
            r.id === selectedResult.id
              ? {
                  ...r,
                  resolved: true,
                  resolvedBy: assignedTo || 'Current User',
                  resolvedAt: new Date().toISOString(),
                  workflowStatus: 'resolved' as WorkflowStatus,
                }
              : r
          )
        );
        setDetailOpen(false);
        setSelectedResult(null);
        setResolveNote('');
        setAssignedTo('');
        await fetchStats();
      }
    } catch (err) {
      console.error('Error resolving:', err);
    }
  };

  // ──────────────────────────────────────────
  // Computed Values
  // ──────────────────────────────────────────
  const filteredResults = useMemo(() => {
    return reconResults.filter((r) => {
      if (selectedClientId && r.clientId !== selectedClientId) return false;
      if (filterStatus !== 'all' && r.matchStatus !== filterStatus) return false;
      if (filterRisk !== 'all') {
        const risk = getRiskLevelForResult(r);
        if (risk !== filterRisk) return false;
      }
      if (filterWorkflow !== 'all' && r.workflowStatus !== filterWorkflow) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const inv = r.invoice;
        const matchInvNum = inv?.invoiceNumber?.toLowerCase().includes(q) ?? false;
        const matchBuyer = inv?.buyerName?.toLowerCase().includes(q) ?? false;
        const matchSrcGstin = r.sourceGstin?.toLowerCase().includes(q) ?? false;
        const matchMatchGstin = r.matchedGstin?.toLowerCase().includes(q) ?? false;
        if (!matchInvNum && !matchBuyer && !matchSrcGstin && !matchMatchGstin) return false;
      }
      return true;
    });
  }, [reconResults, selectedClientId, filterStatus, filterRisk, filterWorkflow, searchQuery]);

  const tabFilteredResults = useMemo(() => {
    switch (activeTab) {
      case 'matched':
        return filteredResults.filter((r) => r.matchStatus === 'perfect_match');
      case 'mismatches':
        return filteredResults.filter(
          (r) => r.matchStatus === 'mismatch' || r.matchStatus === 'partial_match'
        );
      case 'missing':
        return filteredResults.filter(
          (r) => r.matchStatus === 'missing_in_books' || r.matchStatus === 'missing_in_gstr'
        );
      case 'high_risk':
        return filteredResults.filter((r) => {
          const risk = getRiskLevelForResult(r);
          return risk === 'high' || risk === 'critical';
        });
      case 'duplicates':
        return filteredResults.filter((r) => r.matchStatus === 'duplicate');
      default:
        return filteredResults;
    }
  }, [filteredResults, activeTab]);

  const kpiData = useMemo(() => {
    if (stats) {
      return {
        totalRecords: stats.totalResults,
        matched: stats.matchBreakdown?.perfect_match ?? 0,
        unmatched:
          (stats.matchBreakdown?.mismatch ?? 0) +
          (stats.matchBreakdown?.unmatched ?? 0),
        partialMatches: stats.matchBreakdown?.partial_match ?? 0,
        highRisk: stats.riskBreakdown?.highAndCritical ?? 0,
        gstDifference: stats.totalGstDifference ?? 0,
      };
    }
    const total = reconResults.length;
    const matched = reconResults.filter((r) => r.matchStatus === 'perfect_match').length;
    const unmatched = reconResults.filter(
      (r) => r.matchStatus === 'mismatch' || r.matchStatus === 'unmatched'
    ).length;
    const partial = reconResults.filter((r) => r.matchStatus === 'partial_match').length;
    const highRisk = reconResults.filter((r) => {
      const risk = getRiskLevelForResult(r);
      return risk === 'high' || risk === 'critical';
    }).length;
    let gstDiff = 0;
    for (const r of reconResults) {
      if (r.mismatches) {
        try {
          const parsed = JSON.parse(r.mismatches);
          if (Array.isArray(parsed)) {
            for (const m of parsed) {
              if (m.field === 'gst_amount' && m.difference) {
                gstDiff += Math.abs(m.difference);
              }
            }
          }
        } catch {
          /* ignore */
        }
      }
    }
    return { totalRecords: total, matched, unmatched, partialMatches: partial, highRisk, gstDifference: gstDiff };
  }, [stats, reconResults]);

  const hasActiveFilters =
    filterStatus !== 'all' || filterRisk !== 'all' || filterWorkflow !== 'all' || searchQuery !== '';

  // ──────────────────────────────────────────
  // Render Helpers
  // ──────────────────────────────────────────
  const renderReconTable = (results: ReconciliationResult[]) => {
    if (loading) {
      return (
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 13 }).map((_, j) => (
                <TableCell key={j}>
                  <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      );
    }

    if (results.length === 0) {
      return (
        <TableBody>
          <TableRow>
            <TableCell colSpan={13} className="text-center py-16 text-muted-foreground">
              <HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-base font-medium">No reconciliation results found</p>
              <p className="text-sm mt-1">Run reconciliation to start matching your records</p>
            </TableCell>
          </TableRow>
        </TableBody>
      );
    }

    return (
      <TableBody>
        {results.map((result) => {
          const statusCfg = MATCH_STATUS_CONFIG[result.matchStatus as MatchStatus];
          const invoice = result.invoice;
          const riskLevel = getRiskLevelForResult(result);
          const riskCfg = RISK_LEVEL_CONFIG[riskLevel];
          const workflowCfg = WORKFLOW_STATUS_CONFIG[result.workflowStatus as WorkflowStatus];
          const aiRec = getAIRecConfig(result.aiRecommendation);
          const gstAmount = invoice
            ? invoice.cgst + invoice.sgst + invoice.igst
            : 0;

          return (
            <TableRow
              key={result.id}
              className="hover:bg-accent/40 transition-colors cursor-pointer"
              onClick={() => {
                setSelectedResult(result);
                setDetailOpen(true);
              }}
            >
              {/* Invoice Number */}
              <TableCell className="font-medium text-sm whitespace-nowrap">
                {invoice?.invoiceNumber || '—'}
              </TableCell>

              {/* Vendor/Buyer Name */}
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap max-w-[150px] truncate">
                {invoice?.buyerName || invoice?.sellerGstin?.slice(0, 10) + '...' || '—'}
              </TableCell>

              {/* GSTIN */}
              <TableCell className="font-mono text-xs whitespace-nowrap">
                {result.matchedGstin || result.sourceGstin || '—'}
              </TableCell>

              {/* Taxable Amount */}
              <TableCell className="text-sm text-right whitespace-nowrap">
                {invoice ? formatCurrency(invoice.taxableValue) : '—'}
              </TableCell>

              {/* GST Amount */}
              <TableCell className="text-sm text-right whitespace-nowrap">
                {invoice ? formatCurrency(gstAmount) : '—'}
              </TableCell>

              {/* Source A */}
              <TableCell className="whitespace-nowrap">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50 border-slate-200 text-slate-600">
                  {result.sourceA || 'Purchase Register'}
                </Badge>
              </TableCell>

              {/* Source B */}
              <TableCell className="whitespace-nowrap">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50 border-slate-200 text-slate-600">
                  {result.sourceB || 'GSTR-2B'}
                </Badge>
              </TableCell>

              {/* Match Status */}
              <TableCell className="whitespace-nowrap">
                {statusCfg ? (
                  <Badge
                    variant="outline"
                    className={`${statusCfg.color} ${statusCfg.bgColor} border text-xs`}
                  >
                    {statusCfg.label}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    {result.matchStatus}
                  </Badge>
                )}
              </TableCell>

              {/* Risk Level */}
              <TableCell className="whitespace-nowrap">
                <Badge
                  variant="outline"
                  className={`${riskCfg.color} ${riskCfg.bgColor} border text-xs`}
                >
                  {riskCfg.icon} {riskCfg.label}
                </Badge>
              </TableCell>

              {/* AI Recommendation */}
              <TableCell className="whitespace-nowrap">
                {aiRec ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={`text-xs ${aiRec.color} flex items-center gap-1`}>
                          <span>{aiRec.icon}</span>
                          <span className="truncate max-w-[100px] inline-block">
                            {truncate(aiRec.label, 25)}
                          </span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{aiRec.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <span className="text-xs text-slate-400 italic">—</span>
                )}
              </TableCell>

              {/* Confidence */}
              <TableCell className="whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <Progress
                    value={result.confidenceScore}
                    className={`h-1.5 w-12 ${getConfidenceBarColor(result.confidenceScore)}`}
                  />
                  <span className={`text-[10px] font-semibold ${getConfidenceColor(result.confidenceScore)}`}>
                    {Math.round(result.confidenceScore)}%
                  </span>
                </div>
              </TableCell>

              {/* Workflow Status */}
              <TableCell className="whitespace-nowrap">
                {workflowCfg ? (
                  <Badge
                    variant="outline"
                    className={`${workflowCfg.color} ${workflowCfg.bgColor} border text-xs`}
                  >
                    {workflowCfg.label}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    {result.workflowStatus}
                  </Badge>
                )}
              </TableCell>

              {/* Actions */}
              <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedResult(result);
                        setDetailOpen(true);
                      }}
                      className="gap-2"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleUpdateWorkflow(result.id, 'under_review')}
                      disabled={result.workflowStatus === 'under_review' || result.resolved}
                      className="gap-2"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      Mark Under Review
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedResult(result);
                        setAssignedTo('');
                        setResolveNote('');
                        setDetailOpen(true);
                      }}
                      disabled={result.resolved}
                      className="gap-2"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Resolve
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleUpdateWorkflow(result.id, 'ignored')}
                      disabled={result.workflowStatus === 'ignored' || result.resolved}
                      className="gap-2"
                    >
                      <X className="h-3.5 w-3.5" />
                      Ignore
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleUpdateWorkflow(result.id, 'escalated')}
                      disabled={result.workflowStatus === 'escalated' || result.resolved}
                      className="gap-2 text-red-600 focus:text-red-600"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Escalate
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    );
  };

  // ──────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ════════════════════════════════════════════
          1. Page Header
      ════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Reconciliation Center
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            GST Auto-Matching &amp; AI Analysis Engine
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="gap-1.5 px-3 py-1 border-emerald-200 text-emerald-700 bg-emerald-50"
          >
            <Shield className="h-3.5 w-3.5" />
            Auto-Match
          </Badge>
          <Badge
            variant="outline"
            className="gap-1.5 px-3 py-1 border-purple-200 text-purple-700 bg-purple-50"
          >
            <Zap className="h-3.5 w-3.5" />
            AI-Powered
          </Badge>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          2. Matching Dashboard — 6 KPI Cards
      ════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Records */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-slate-100">
                <Database className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpiData.totalRecords}</p>
                <p className="text-[11px] text-muted-foreground">Total Records</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
              <Activity className="h-3 w-3" />
              <span>Across all sources</span>
            </div>
          </CardContent>
        </Card>

        {/* Matched */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-50">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">{kpiData.matched}</p>
                <p className="text-[11px] text-muted-foreground">Matched</p>
              </div>
            </div>
            <div className="mt-2">
              <Progress
                value={kpiData.totalRecords > 0 ? (kpiData.matched / kpiData.totalRecords) * 100 : 0}
                className="h-1.5 [&>div]:bg-emerald-500"
              />
              <p className="text-[10px] text-emerald-600 mt-0.5">
                {kpiData.totalRecords > 0
                  ? Math.round((kpiData.matched / kpiData.totalRecords) * 100)
                  : 0}
                % match rate
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Unmatched */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-red-50">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-700">{kpiData.unmatched}</p>
                <p className="text-[11px] text-muted-foreground">Unmatched</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-red-500">
              <AlertOctagon className="h-3 w-3" />
              <span>Require review</span>
            </div>
          </CardContent>
        </Card>

        {/* Partial Matches */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-amber-50">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{kpiData.partialMatches}</p>
                <p className="text-[11px] text-muted-foreground">Partial Matches</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-500">
              <TrendingUp className="h-3 w-3" />
              <span>Minor discrepancies</span>
            </div>
          </CardContent>
        </Card>

        {/* High Risk */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-orange-50">
                <ShieldAlert className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-700">{kpiData.highRisk}</p>
                <p className="text-[11px] text-muted-foreground">High Risk</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-orange-500">
              <ShieldAlert className="h-3 w-3" />
              <span>Critical &amp; high</span>
            </div>
          </CardContent>
        </Card>

        {/* GST Difference */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-purple-50">
                <IndianRupee className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-purple-700">
                  {formatCurrency(kpiData.gstDifference)}
                </p>
                <p className="text-[11px] text-muted-foreground">GST Difference</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-purple-500">
              <TrendingUp className="h-3 w-3" />
              <span>Needs reconciliation</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ════════════════════════════════════════════
          3. Action Bar Card
      ════════════════════════════════════════════ */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {/* Client Selector */}
            <Select
              value={selectedClientId ?? 'all'}
              onValueChange={(v) => setSelectedClientId(v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-full lg:w-[220px]">
                <SelectValue placeholder="Select Client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.tradeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Period Selector */}
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-full lg:w-[160px]">
                <SelectValue placeholder="Select Period" />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Source Comparison Selector */}
            <Select value={selectedSource} onValueChange={setSelectedSource}>
              <SelectTrigger className="w-full lg:w-[260px]">
                <SelectValue placeholder="Source Comparison" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1" />

            {/* Run Reconciliation */}
            <Button
              onClick={handleRunReconciliation}
              disabled={runningRecon || !selectedClientId}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white min-w-[180px]"
            >
              {runningRecon ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {runningRecon ? 'Running Reconciliation...' : 'Run Reconciliation'}
            </Button>

            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 min-w-[100px]" disabled={exporting}>
                  {exporting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleExport('excel')} className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-2">
                  <FileText className="h-4 w-4" />
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('summary')} className="gap-2">
                  <ClipboardList className="h-4 w-4" />
                  GST Summary
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('mismatch')} className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Mismatch Report
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('risk')} className="gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  Risk Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════
          4. Filter Row
      ════════════════════════════════════════════ */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoice #, GSTIN, vendor..."
                className="pl-8 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Match Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue placeholder="Match Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Match Statuses</SelectItem>
                {Object.entries(MATCH_STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    {cfg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Risk Level Filter */}
            <Select value={filterRisk} onValueChange={setFilterRisk}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                {Object.entries(RISK_LEVEL_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    {cfg.icon} {cfg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Workflow Status Filter */}
            <Select value={filterWorkflow} onValueChange={setFilterWorkflow}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Workflow" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workflow</SelectItem>
                {Object.entries(WORKFLOW_STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    {cfg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-slate-500 hover:text-slate-700 shrink-0"
                onClick={() => {
                  setFilterStatus('all');
                  setFilterRisk('all');
                  setFilterWorkflow('all');
                  setSearchQuery('');
                }}
              >
                <X className="h-3.5 w-3.5" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════
          5 & 6. Tabs Section + Reconciliation Grid
      ════════════════════════════════════════════ */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all" className="gap-1.5">
            All Records
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
              {filteredResults.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="matched" className="gap-1.5">
            Matched
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700">
              {filteredResults.filter((r) => r.matchStatus === 'perfect_match').length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="mismatches" className="gap-1.5">
            Mismatches
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-red-50 text-red-700">
              {filteredResults.filter((r) => r.matchStatus === 'mismatch' || r.matchStatus === 'partial_match').length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="missing" className="gap-1.5">
            Missing
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700">
              {filteredResults.filter((r) => r.matchStatus === 'missing_in_books' || r.matchStatus === 'missing_in_gstr').length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="high_risk" className="gap-1.5">
            High Risk
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-orange-50 text-orange-700">
              {filteredResults.filter((r) => {
                const risk = getRiskLevelForResult(r);
                return risk === 'high' || risk === 'critical';
              }).length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="duplicates" className="gap-1.5">
            Duplicates
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-pink-50 text-pink-700">
              {filteredResults.filter((r) => r.matchStatus === 'duplicate').length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* All Records Tab */}
        <TabsContent value="all">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-5 w-5 text-slate-600" />
                All Reconciliation Records
                <Badge variant="secondary" className="ml-1">
                  {tabFilteredResults.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table style={{ minWidth: 1200 }}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Vendor/Buyer</TableHead>
                      <TableHead>GSTIN</TableHead>
                      <TableHead className="text-right">Taxable Amount</TableHead>
                      <TableHead className="text-right">GST Amount</TableHead>
                      <TableHead>Source A</TableHead>
                      <TableHead>Source B</TableHead>
                      <TableHead>Match Status</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>AI Recommendation</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  {renderReconTable(tabFilteredResults)}
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Matched Tab */}
        <TabsContent value="matched">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Perfect Matches
                <Badge variant="secondary" className="ml-1 bg-emerald-50 text-emerald-700">
                  {tabFilteredResults.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table style={{ minWidth: 1200 }}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Vendor/Buyer</TableHead>
                      <TableHead>GSTIN</TableHead>
                      <TableHead className="text-right">Taxable Amount</TableHead>
                      <TableHead className="text-right">GST Amount</TableHead>
                      <TableHead>Source A</TableHead>
                      <TableHead>Source B</TableHead>
                      <TableHead>Match Status</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>AI Recommendation</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  {renderReconTable(tabFilteredResults)}
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mismatches Tab */}
        <TabsContent value="mismatches">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertOctagon className="h-5 w-5 text-red-600" />
                Mismatches &amp; Partial Matches
                <Badge variant="secondary" className="ml-1 bg-red-50 text-red-700">
                  {tabFilteredResults.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table style={{ minWidth: 1200 }}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Vendor/Buyer</TableHead>
                      <TableHead>GSTIN</TableHead>
                      <TableHead className="text-right">Taxable Amount</TableHead>
                      <TableHead className="text-right">GST Amount</TableHead>
                      <TableHead>Source A</TableHead>
                      <TableHead>Source B</TableHead>
                      <TableHead>Match Status</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>AI Recommendation</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  {renderReconTable(tabFilteredResults)}
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Missing Tab */}
        <TabsContent value="missing">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-purple-600" />
                Missing Records
                <Badge variant="secondary" className="ml-1 bg-purple-50 text-purple-700">
                  {tabFilteredResults.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table style={{ minWidth: 1200 }}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Vendor/Buyer</TableHead>
                      <TableHead>GSTIN</TableHead>
                      <TableHead className="text-right">Taxable Amount</TableHead>
                      <TableHead className="text-right">GST Amount</TableHead>
                      <TableHead>Source A</TableHead>
                      <TableHead>Source B</TableHead>
                      <TableHead>Match Status</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>AI Recommendation</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  {renderReconTable(tabFilteredResults)}
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* High Risk Tab */}
        <TabsContent value="high_risk">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-orange-600" />
                High Risk Records
                <Badge variant="secondary" className="ml-1 bg-orange-50 text-orange-700">
                  {tabFilteredResults.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table style={{ minWidth: 1200 }}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Vendor/Buyer</TableHead>
                      <TableHead>GSTIN</TableHead>
                      <TableHead className="text-right">Taxable Amount</TableHead>
                      <TableHead className="text-right">GST Amount</TableHead>
                      <TableHead>Source A</TableHead>
                      <TableHead>Source B</TableHead>
                      <TableHead>Match Status</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>AI Recommendation</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  {renderReconTable(tabFilteredResults)}
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Duplicates Tab */}
        <TabsContent value="duplicates">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Copy className="h-5 w-5 text-pink-600" />
                Duplicate Records
                <Badge variant="secondary" className="ml-1 bg-pink-50 text-pink-700">
                  {tabFilteredResults.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table style={{ minWidth: 1200 }}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Vendor/Buyer</TableHead>
                      <TableHead>GSTIN</TableHead>
                      <TableHead className="text-right">Taxable Amount</TableHead>
                      <TableHead className="text-right">GST Amount</TableHead>
                      <TableHead>Source A</TableHead>
                      <TableHead>Source B</TableHead>
                      <TableHead>Match Status</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>AI Recommendation</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  {renderReconTable(tabFilteredResults)}
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ════════════════════════════════════════════
          7. Detail Dialog
      ════════════════════════════════════════════ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedResult && (() => {
            const invoice = selectedResult.invoice;
            const riskLevel = getRiskLevelForResult(selectedResult);
            const riskCfg = RISK_LEVEL_CONFIG[riskLevel];
            const statusCfg = MATCH_STATUS_CONFIG[selectedResult.matchStatus as MatchStatus];
            const workflowCfg = WORKFLOW_STATUS_CONFIG[selectedResult.workflowStatus as WorkflowStatus];
            const aiRec = getAIRecConfig(selectedResult.aiRecommendation);
            const parsedMismatches = parseMismatches(selectedResult.mismatches);
            const gstAmount = invoice ? invoice.cgst + invoice.sgst + invoice.igst : 0;

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-emerald-600" />
                    Reconciliation Detail
                  </DialogTitle>
                  <DialogDescription>
                    Invoice {invoice?.invoiceNumber || selectedResult.invoiceId} —{' '}
                    {statusCfg?.label || selectedResult.matchStatus}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 mt-2">
                  {/* ── Invoice Details ── */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                      <Database className="h-4 w-4" />
                      Invoice Details
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Invoice Number</span>
                        <p className="font-medium">{invoice?.invoiceNumber || '—'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Invoice Date</span>
                        <p className="font-medium">
                          {invoice?.invoiceDate
                            ? new Date(invoice.invoiceDate).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Vendor / Seller GSTIN</span>
                        <p className="font-mono text-xs">{invoice?.sellerGstin || '—'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Buyer Name</span>
                        <p className="font-medium">{invoice?.buyerName || '—'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Taxable Value</span>
                        <p className="font-medium">{invoice ? formatCurrency(invoice.taxableValue) : '—'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Total Amount</span>
                        <p className="font-medium">{invoice ? formatCurrency(invoice.totalAmount) : '—'}</p>
                      </div>
                    </div>

                    {/* GST Breakdown */}
                    {invoice && (
                      <div className="mt-3 grid grid-cols-4 gap-2">
                        <div className="rounded-md bg-slate-50 p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">CGST</p>
                          <p className="text-xs font-semibold">{formatCurrency(invoice.cgst)}</p>
                        </div>
                        <div className="rounded-md bg-slate-50 p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">SGST</p>
                          <p className="text-xs font-semibold">{formatCurrency(invoice.sgst)}</p>
                        </div>
                        <div className="rounded-md bg-slate-50 p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">IGST</p>
                          <p className="text-xs font-semibold">{formatCurrency(invoice.igst)}</p>
                        </div>
                        <div className="rounded-md bg-slate-50 p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">Cess</p>
                          <p className="text-xs font-semibold">{formatCurrency(invoice.cess)}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* ── Match Details ── */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                      <Shield className="h-4 w-4" />
                      Match Details
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      <div className="rounded-md border p-3">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Source A</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50">
                            {selectedResult.sourceA || 'Purchase Register'}
                          </Badge>
                        </div>
                        <p className="font-mono text-xs mt-1">
                          {selectedResult.sourceGstin || '—'}
                        </p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Source B</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50">
                            {selectedResult.sourceB || 'GSTR-2B'}
                          </Badge>
                        </div>
                        <p className="font-mono text-xs mt-1">
                          {selectedResult.matchedGstin || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Match Score</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Progress
                            value={selectedResult.matchScore}
                            className="h-2 flex-1"
                          />
                          <span className="text-sm font-bold">{Math.round(selectedResult.matchScore)}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Confidence Score</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Progress
                            value={selectedResult.confidenceScore}
                            className={`h-2 flex-1 ${getConfidenceBarColor(selectedResult.confidenceScore)}`}
                          />
                          <span className={`text-sm font-bold ${getConfidenceColor(selectedResult.confidenceScore)}`}>
                            {Math.round(selectedResult.confidenceScore)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs text-muted-foreground">Status:</span>
                      {statusCfg && (
                        <Badge variant="outline" className={`${statusCfg.color} ${statusCfg.bgColor} border text-xs`}>
                          {statusCfg.label}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-2">Risk:</span>
                      <Badge variant="outline" className={`${riskCfg.color} ${riskCfg.bgColor} border text-xs`}>
                        {riskCfg.icon} {riskCfg.label}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  {/* ── Mismatch Breakdown ── */}
                  {parsedMismatches.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Mismatch Breakdown
                      </h4>
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Field</TableHead>
                              <TableHead className="text-xs">Books Value</TableHead>
                              <TableHead className="text-xs">Portal Value</TableHead>
                              <TableHead className="text-xs">Difference</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {parsedMismatches.map((m, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-xs font-medium">
                                  {formatFieldName(m.field)}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {typeof m.expected === 'number'
                                    ? formatCurrency(m.expected)
                                    : String(m.expected)}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {typeof m.actual === 'number'
                                    ? formatCurrency(m.actual)
                                    : String(m.actual)}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {m.difference ? (
                                    <span className="text-red-600 font-medium">
                                      {typeof m.difference === 'number'
                                        ? formatCurrency(m.difference)
                                        : String(m.difference)}
                                    </span>
                                  ) : (
                                    <span className="text-amber-600">Differs</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* ── AI Explanation ── */}
                  {selectedResult.aiExplanation && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                        <Zap className="h-4 w-4 text-purple-500" />
                        AI Explanation
                      </h4>
                      <div className="rounded-md bg-purple-50 border border-purple-100 p-3">
                        <p className="text-sm text-purple-900 leading-relaxed">
                          {selectedResult.aiExplanation}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── AI Recommendation ── */}
                  {aiRec && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4 text-blue-500" />
                        AI Recommendation
                      </h4>
                      <div className="flex items-center gap-2 rounded-md border p-3">
                        <span className="text-lg">{aiRec.icon}</span>
                        <span className={`text-sm font-medium ${aiRec.color}`}>
                          {aiRec.label}
                        </span>
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* ── Workflow Status Selector ── */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                      <Activity className="h-4 w-4" />
                      Workflow Status
                    </h4>
                    <div className="flex items-center gap-2">
                      <Select
                        value={selectedResult.workflowStatus}
                        onValueChange={(v) =>
                          handleUpdateWorkflow(selectedResult.id, v as WorkflowStatus)
                        }
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(WORKFLOW_STATUS_CONFIG).map(([key, cfg]) => (
                            <SelectItem key={key} value={key}>
                              {cfg.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {workflowCfg && (
                        <Badge
                          variant="outline"
                          className={`${workflowCfg.color} ${workflowCfg.bgColor} border text-xs`}
                        >
                          {workflowCfg.label}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* ── Resolve Section ── */}
                  {!selectedResult.resolved && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Resolve This Issue
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">
                            Assign To
                          </label>
                          <Select value={assignedTo} onValueChange={setAssignedTo}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select team member" />
                            </SelectTrigger>
                            <SelectContent>
                              {TEAM_MEMBERS.map((m) => (
                                <SelectItem key={m.id} value={m.name}>
                                  <div className="flex items-center gap-2">
                                    <User className="h-3 w-3" />
                                    {m.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">
                            Resolution Note
                          </label>
                          <Textarea
                            placeholder="Add a note about how this was resolved..."
                            value={resolveNote}
                            onChange={(e) => setResolveNote(e.target.value)}
                            rows={3}
                          />
                        </div>
                        <Button
                          onClick={handleResolve}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                          disabled={!assignedTo}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Mark as Resolved
                        </Button>
                      </div>
                    </div>
                  )}

                  {selectedResult.resolved && (
                    <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-700">
                          This issue has been resolved
                        </span>
                      </div>
                      {selectedResult.resolvedBy && (
                        <p className="text-xs text-emerald-600 mt-1">
                          Resolved by: {selectedResult.resolvedBy}
                        </p>
                      )}
                      {selectedResult.resolvedAt && (
                        <p className="text-xs text-emerald-600">
                          On: {new Date(selectedResult.resolvedAt).toLocaleDateString('en-IN')}
                        </p>
                      )}
                    </div>
                  )}

                  <Separator />

                  {/* ── Activity Log Note ── */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      Activity Log
                    </h4>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>
                        Created:{' '}
                        {new Date(selectedResult.createdAt).toLocaleString('en-IN')}
                      </p>
                      <p>
                        Last Updated:{' '}
                        {new Date(selectedResult.updatedAt).toLocaleString('en-IN')}
                      </p>
                      {selectedResult.run && (
                        <p>
                          Reconciliation Run: {selectedResult.run.period} —{' '}
                          {selectedResult.run.sources}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setDetailOpen(false)}>
                    Close
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════
          7b. Empty State (shown when no results at all)
      ════════════════════════════════════════════ */}
      {!loading && reconResults.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Database className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700 mb-1">
              No reconciliation results found
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Run reconciliation to start matching your records and identify discrepancies.
            </p>
            <Button
              onClick={handleRunReconciliation}
              disabled={runningRecon || !selectedClientId}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {runningRecon ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {runningRecon ? 'Running...' : 'Run Reconciliation'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════
          8. Run History Section
      ════════════════════════════════════════════ */}
      {runs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-600" />
              Recent Reconciliation Runs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table style={{ minWidth: 1000 }}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Sources</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Matched</TableHead>
                    <TableHead className="text-right">Unmatched</TableHead>
                    <TableHead className="text-right">Partial</TableHead>
                    <TableHead className="text-right">High Risk</TableHead>
                    <TableHead className="text-right">GST Diff</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Run By</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => {
                    const runStatus =
                      run.status === 'completed'
                        ? { color: 'text-emerald-700', bgColor: 'bg-emerald-50', label: 'Completed' }
                        : run.status === 'running'
                        ? { color: 'text-blue-700', bgColor: 'bg-blue-50', label: 'Running' }
                        : { color: 'text-red-700', bgColor: 'bg-red-50', label: 'Failed' };

                    return (
                      <TableRow
                        key={run.id}
                        className="hover:bg-accent/40 transition-colors cursor-pointer"
                        onClick={() => {
                          // Filter results by this run
                          const runResults = reconResults.filter(
                            (r) => r.runId === run.id
                          );
                          if (runResults.length > 0) {
                            setReconResults(runResults);
                          }
                        }}
                      >
                        <TableCell className="font-medium text-sm whitespace-nowrap">
                          {run.period}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50">
                              {run.sources?.split(',')[0] || 'Source A'}
                            </Badge>
                            <ArrowRight className="h-3 w-3 text-slate-400" />
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50">
                              {run.sources?.split(',')[1] || 'Source B'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-right">{run.totalRecords}</TableCell>
                        <TableCell className="text-sm text-right text-emerald-700 font-medium">
                          {run.matched}
                        </TableCell>
                        <TableCell className="text-sm text-right text-red-700 font-medium">
                          {run.unmatched}
                        </TableCell>
                        <TableCell className="text-sm text-right text-amber-700 font-medium">
                          {run.partialMatches}
                        </TableCell>
                        <TableCell className="text-sm text-right text-orange-700 font-medium">
                          {run.highRisk}
                        </TableCell>
                        <TableCell className="text-sm text-right text-purple-700 font-medium">
                          {formatCurrency(run.gstDifference)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${runStatus.color} ${runStatus.bgColor} border text-xs`}
                          >
                            {runStatus.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {run.runBy || 'System'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(run.createdAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
