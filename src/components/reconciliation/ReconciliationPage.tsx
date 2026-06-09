'use client';

import React, { useState, useEffect } from 'react';
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
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  Eye,
  Zap,
  ArrowRight,
  Shield,
  TrendingUp,
  AlertOctagon,
  HelpCircle,
} from 'lucide-react';
import type { ReconciliationResult, Invoice, MatchStatus } from '@/types/gst';
import { MATCH_STATUS_CONFIG, RISK_LEVEL_CONFIG } from '@/types/gst';
import { formatCurrency, generateMismatchExplanation } from '@/lib/gst-utils';
import { useApp } from '@/contexts/AppContext';

// ---------- Team Members (static) ----------
const TEAM_MEMBERS = [
  { id: 'tm1', name: 'Rahul Sharma' },
  { id: 'tm2', name: 'Priya Patel' },
  { id: 'tm3', name: 'Amit Kumar' },
  { id: 'tm4', name: 'Sneha Reddy' },
  { id: 'tm5', name: 'Vikram Singh' },
];

// ---------- Periods (static) ----------
const PERIODS = [
  '2026-03',
  '2026-02',
  '2026-01',
  '2025-12',
  '2025-11',
  '2025-10',
];

// ---------- Helper: parse mismatches JSON ----------
function parseMismatches(mismatches?: string | null): { field: string; books: number; gstr: number }[] {
  if (!mismatches) return [];
  try {
    return JSON.parse(mismatches);
  } catch {
    return [];
  }
}

// ---------- Helper: format mismatch field name ----------
function formatFieldName(field: string): string {
  const map: Record<string, string> = {
    totalAmount: 'Total Amount',
    tax: 'Tax Amount',
    cgst: 'CGST',
    sgst: 'SGST',
    igst: 'IGST',
    cess: 'Cess',
    taxableValue: 'Taxable Value',
  };
  return map[field] || field;
}

// ===================== MAIN COMPONENT =====================
export default function ReconciliationPage() {
  const { selectedClientId, setSelectedClientId } = useApp();

  // Data
  const [reconResults, setReconResults] = useState<ReconciliationResult[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<{ id: string; tradeName: string; gstin: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningRecon, setRunningRecon] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  // Filters
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-02');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterResolved, setFilterResolved] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ReconciliationResult | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  // ---------- Fetch data on mount ----------
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [reconRes, invRes, clientRes] = await Promise.all([
          fetch('/api/reconciliation'),
          fetch('/api/invoices'),
          fetch('/api/clients'),
        ]);

        if (reconRes.ok) {
          const reconData = await reconRes.json();
          setReconResults(reconData.results || []);
        }
        if (invRes.ok) {
          const invData = await invRes.json();
          setInvoices(invData.invoices || []);
        }
        if (clientRes.ok) {
          const clientData = await clientRes.json();
          setClients(clientData.clients || []);
        }
      } catch (err) {
        console.error('Error fetching reconciliation data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // ---------- Refetch reconciliation results ----------
  const refetchResults = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedClientId) params.set('clientId', selectedClientId);
      if (filterStatus !== 'all') params.set('matchStatus', filterStatus);
      if (filterResolved !== 'all') params.set('resolved', filterResolved);

      const res = await fetch(`/api/reconciliation?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReconResults(data.results || []);
      }
    } catch (err) {
      console.error('Error refetching:', err);
    }
  };

  // ---------- Run reconciliation ----------
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
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await refetchResults();
      }
    } catch (err) {
      console.error('Error running reconciliation:', err);
    } finally {
      setRunningRecon(false);
    }
  };

  // ---------- AI Analyze ----------
  const handleAiAnalyze = async () => {
    setAiAnalyzing(true);
    try {
      const mismatchResults = reconResults.filter(
        (r) => !r.resolved && (r.matchStatus === 'mismatch' || r.matchStatus === 'partial_match' || r.matchStatus === 'missing_in_books' || r.matchStatus === 'missing_in_gstr')
      );

      if (mismatchResults.length === 0) {
        setAiAnalyzing(false);
        return;
      }

      // Build a summary of mismatches for the AI to analyze
      const mismatchSummary = mismatchResults.map((r) => ({
        id: r.id,
        invoiceId: r.invoiceId,
        matchStatus: r.matchStatus,
        matchScore: r.matchScore,
        sourceGstin: r.sourceGstin,
        matchedGstin: r.matchedGstin,
        mismatches: r.mismatches,
        currentExplanation: r.aiExplanation,
      }));

      // Call the reconciliation API with AI analysis request
      const res = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ai_analyze',
          mismatches: mismatchSummary,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Update local results with AI explanations
        if (data.updatedResults) {
          setReconResults((prev) =>
            prev.map((r) => {
              const updated = data.updatedResults.find((u: { id: string }) => u.id === r.id);
              return updated ? { ...r, aiExplanation: updated.aiExplanation || r.aiExplanation } : r;
            })
          );
        } else {
          await refetchResults();
        }
      }
    } catch (err) {
      console.error('Error during AI analysis:', err);
    } finally {
      setAiAnalyzing(false);
    }
  };

  // ---------- Resolve a result ----------
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
              ? { ...r, resolved: true, resolvedBy: assignedTo || 'Current User', resolvedAt: new Date().toISOString() }
              : r
          )
        );
        setDetailOpen(false);
        setSelectedResult(null);
        setResolveNote('');
        setAssignedTo('');
      }
    } catch (err) {
      console.error('Error resolving:', err);
    }
  };

  // ---------- Computed KPIs ----------
  const totalMatched = reconResults.filter((r) => r.matchStatus === 'perfect_match').length;
  const perfectMatchPct = reconResults.length > 0 ? Math.round((totalMatched / reconResults.length) * 100) : 0;
  const mismatchesFound = reconResults.filter((r) => r.matchStatus === 'mismatch' || r.matchStatus === 'partial_match').length;
  const unresolved = reconResults.filter((r) => !r.resolved).length;

  // ---------- Filtered results ----------
  const filteredResults = reconResults.filter((r) => {
    if (filterStatus !== 'all' && r.matchStatus !== filterStatus) return false;
    if (filterResolved === 'resolved' && !r.resolved) return false;
    if (filterResolved === 'unresolved' && r.resolved) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const inv = r.invoice;
      const matchInvNum = inv?.invoiceNumber?.toLowerCase().includes(q) ?? false;
      const matchSrcGstin = r.sourceGstin?.toLowerCase().includes(q) ?? false;
      const matchMatchGstin = r.matchedGstin?.toLowerCase().includes(q) ?? false;
      if (!matchInvNum && !matchSrcGstin && !matchMatchGstin) return false;
    }
    if (selectedClientId && r.clientId !== selectedClientId) return false;
    return true;
  });

  // ---------- Match score color ----------
  function getMatchScoreColor(score: number): string {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  }

  function getMatchScoreTextColor(score: number): string {
    if (score >= 80) return 'text-emerald-700';
    if (score >= 50) return 'text-amber-700';
    return 'text-red-700';
  }

  // ==================== RENDER ====================
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Reconciliation Engine</h1>
          <p className="text-muted-foreground text-sm mt-1">
            GST Books vs GSTR-2B Matching &middot; AI-Powered Analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 px-3 py-1">
            <Shield className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-emerald-700">Auto-Match</span>
          </Badge>
        </div>
      </div>

      {/* ===== KPI Cards ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Matched */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground font-medium">Total Matched</p>
                <p className="text-3xl font-bold">{totalMatched}</p>
                <div className="flex items-center gap-1 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-600 font-medium">of {reconResults.length} invoices</span>
                </div>
              </div>
              <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-emerald-50">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Perfect Match % */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground font-medium">Perfect Match %</p>
                <p className="text-3xl font-bold text-emerald-600">{perfectMatchPct}%</p>
                <div className="flex items-center gap-1 text-xs">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-600 font-medium">
                    {totalMatched} perfect matches
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-emerald-50">
                <TrendingUp className="h-7 w-7 text-emerald-600" />
              </div>
            </div>
            <Progress value={perfectMatchPct} className="mt-3 h-1.5" />
          </CardContent>
        </Card>

        {/* Mismatches Found */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground font-medium">Mismatches Found</p>
                <p className="text-3xl font-bold text-red-600">{mismatchesFound}</p>
                <div className="flex items-center gap-1 text-xs">
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-red-600 font-medium">Require review</span>
                </div>
              </div>
              <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-red-50">
                <AlertOctagon className="h-7 w-7 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Unresolved */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground font-medium">Unresolved</p>
                <p className="text-3xl font-bold text-amber-600">{unresolved}</p>
                <div className="flex items-center gap-1 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-amber-600 font-medium">Pending action</span>
                </div>
              </div>
              <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-amber-50">
                <AlertTriangle className="h-7 w-7 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== Action Bar ===== */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            {/* Client Selector */}
            <Select
              value={selectedClientId ?? 'all'}
              onValueChange={(v) => setSelectedClientId(v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-full md:w-[220px]">
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
              <SelectTrigger className="w-full md:w-[160px]">
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

            <div className="flex-1" />

            {/* Run Reconciliation */}
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

            {/* AI Analyze */}
            <Button
              onClick={handleAiAnalyze}
              disabled={aiAnalyzing || mismatchesFound === 0}
              className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {aiAnalyzing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {aiAnalyzing ? 'Analyzing...' : 'AI Analyze'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ===== Main Content — Tabs ===== */}
      <Tabs defaultValue="all" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList>
            <TabsTrigger value="all">All Results</TabsTrigger>
            <TabsTrigger value="mismatches">Mismatches</TabsTrigger>
            <TabsTrigger value="unresolved">Unresolved</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoice # or GSTIN..."
                className="pl-8 w-full sm:w-[240px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-1" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(MATCH_STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    {cfg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Resolved Filter */}
            <Select value={filterResolved} onValueChange={setFilterResolved}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Resolved" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="unresolved">Unresolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* All Results Tab */}
        <TabsContent value="all">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600" />
                Reconciliation Results
                <Badge variant="secondary" className="ml-2">
                  {filteredResults.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table style={{ minWidth: 1000 }}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Invoice #</TableHead>
                      <TableHead className="w-[100px]">Date</TableHead>
                      <TableHead className="w-[140px]">Source GSTIN</TableHead>
                      <TableHead className="w-[140px]">Matched GSTIN</TableHead>
                      <TableHead className="w-[130px]">Match Status</TableHead>
                      <TableHead className="w-[120px]">Match Score</TableHead>
                      <TableHead className="w-[100px]">Risk Level</TableHead>
                      <TableHead className="w-[140px]">Mismatches</TableHead>
                      <TableHead className="w-[200px]">AI Explanation</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 10 }).map((_, j) => (
                            <TableCell key={j}>
                              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filteredResults.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                          <HelpCircle className="h-10 w-10 mx-auto mb-2 opacity-40" />
                          <p>No reconciliation results found</p>
                          <p className="text-xs mt-1">Run reconciliation or adjust filters</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredResults.map((result) => {
                        const statusCfg = MATCH_STATUS_CONFIG[result.matchStatus];
                        const invoice = result.invoice;
                        const riskLevel = invoice?.riskLevel ?? 'low';
                        const riskCfg = RISK_LEVEL_CONFIG[riskLevel];
                        const parsedMismatches = parseMismatches(result.mismatches);
                        const mismatchLabels = parsedMismatches.length > 0
                          ? parsedMismatches.map((m) => formatFieldName(m.field)).join(', ')
                          : result.matchStatus === 'perfect_match'
                          ? '—'
                          : 'None';

                        return (
                          <TableRow key={result.id} className="hover:bg-accent/40 transition-colors">
                            {/* Invoice # */}
                            <TableCell className="font-medium text-sm">
                              {invoice?.invoiceNumber || '—'}
                            </TableCell>

                            {/* Date */}
                            <TableCell className="text-sm text-muted-foreground">
                              {invoice?.invoiceDate
                                ? new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                                : '—'}
                            </TableCell>

                            {/* Source GSTIN */}
                            <TableCell className="text-xs font-mono">
                              {result.sourceGstin || '—'}
                            </TableCell>

                            {/* Matched GSTIN */}
                            <TableCell className="text-xs font-mono">
                              {result.matchedGstin || '—'}
                            </TableCell>

                            {/* Match Status */}
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`${statusCfg.color} ${statusCfg.bgColor} border text-xs`}
                              >
                                {statusCfg.label}
                              </Badge>
                            </TableCell>

                            {/* Match Score */}
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={result.matchScore}
                                  className="h-2 w-16"
                                />
                                <span className={`text-xs font-semibold ${getMatchScoreTextColor(result.matchScore)}`}>
                                  {result.matchScore}
                                </span>
                              </div>
                            </TableCell>

                            {/* Risk Level */}
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`${riskCfg.color} ${riskCfg.bgColor} border text-xs`}
                              >
                                {riskCfg.icon} {riskCfg.label}
                              </Badge>
                            </TableCell>

                            {/* Mismatches */}
                            <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                              {mismatchLabels}
                            </TableCell>

                            {/* AI Explanation */}
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {result.aiExplanation || (
                                <span className="italic text-slate-400">No AI explanation</span>
                              )}
                            </TableCell>

                            {/* Actions */}
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50"
                                onClick={() => {
                                  setSelectedResult(result);
                                  setDetailOpen(true);
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
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
                Mismatch Results
                <Badge variant="secondary" className="ml-2 bg-red-50 text-red-700">
                  {filteredResults.filter((r) => r.matchStatus === 'mismatch' || r.matchStatus === 'partial_match').length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table style={{ minWidth: 1000 }}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Invoice #</TableHead>
                      <TableHead className="w-[100px]">Date</TableHead>
                      <TableHead className="w-[140px]">Source GSTIN</TableHead>
                      <TableHead className="w-[140px]">Matched GSTIN</TableHead>
                      <TableHead className="w-[130px]">Match Status</TableHead>
                      <TableHead className="w-[120px]">Match Score</TableHead>
                      <TableHead className="w-[100px]">Risk Level</TableHead>
                      <TableHead className="w-[140px]">Mismatches</TableHead>
                      <TableHead className="w-[200px]">AI Explanation</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResults
                      .filter((r) => r.matchStatus === 'mismatch' || r.matchStatus === 'partial_match')
                      .map((result) => {
                        const statusCfg = MATCH_STATUS_CONFIG[result.matchStatus];
                        const invoice = result.invoice;
                        const riskLevel = invoice?.riskLevel ?? 'low';
                        const riskCfg = RISK_LEVEL_CONFIG[riskLevel];
                        const parsedMismatches = parseMismatches(result.mismatches);
                        const mismatchLabels = parsedMismatches.length > 0
                          ? parsedMismatches.map((m) => formatFieldName(m.field)).join(', ')
                          : 'None';

                        return (
                          <TableRow key={result.id} className="hover:bg-accent/40 transition-colors">
                            <TableCell className="font-medium text-sm">{invoice?.invoiceNumber || '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {invoice?.invoiceDate
                                ? new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                                : '—'}
                            </TableCell>
                            <TableCell className="text-xs font-mono">{result.sourceGstin || '—'}</TableCell>
                            <TableCell className="text-xs font-mono">{result.matchedGstin || '—'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${statusCfg.color} ${statusCfg.bgColor} border text-xs`}>
                                {statusCfg.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={result.matchScore} className="h-2 w-16" />
                                <span className={`text-xs font-semibold ${getMatchScoreTextColor(result.matchScore)}`}>
                                  {result.matchScore}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${riskCfg.color} ${riskCfg.bgColor} border text-xs`}>
                                {riskCfg.icon} {riskCfg.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">{mismatchLabels}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {result.aiExplanation || <span className="italic text-slate-400">No AI explanation</span>}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50"
                                onClick={() => {
                                  setSelectedResult(result);
                                  setDetailOpen(true);
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Unresolved Tab */}
        <TabsContent value="unresolved">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Unresolved Items
                <Badge variant="secondary" className="ml-2 bg-amber-50 text-amber-700">
                  {filteredResults.filter((r) => !r.resolved).length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table style={{ minWidth: 1000 }}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Invoice #</TableHead>
                      <TableHead className="w-[100px]">Date</TableHead>
                      <TableHead className="w-[140px]">Source GSTIN</TableHead>
                      <TableHead className="w-[140px]">Matched GSTIN</TableHead>
                      <TableHead className="w-[130px]">Match Status</TableHead>
                      <TableHead className="w-[120px]">Match Score</TableHead>
                      <TableHead className="w-[100px]">Risk Level</TableHead>
                      <TableHead className="w-[140px]">Mismatches</TableHead>
                      <TableHead className="w-[200px]">AI Explanation</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResults
                      .filter((r) => !r.resolved)
                      .map((result) => {
                        const statusCfg = MATCH_STATUS_CONFIG[result.matchStatus];
                        const invoice = result.invoice;
                        const riskLevel = invoice?.riskLevel ?? 'low';
                        const riskCfg = RISK_LEVEL_CONFIG[riskLevel];
                        const parsedMismatches = parseMismatches(result.mismatches);
                        const mismatchLabels = parsedMismatches.length > 0
                          ? parsedMismatches.map((m) => formatFieldName(m.field)).join(', ')
                          : 'None';

                        return (
                          <TableRow key={result.id} className="hover:bg-accent/40 transition-colors">
                            <TableCell className="font-medium text-sm">{invoice?.invoiceNumber || '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {invoice?.invoiceDate
                                ? new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                                : '—'}
                            </TableCell>
                            <TableCell className="text-xs font-mono">{result.sourceGstin || '—'}</TableCell>
                            <TableCell className="text-xs font-mono">{result.matchedGstin || '—'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${statusCfg.color} ${statusCfg.bgColor} border text-xs`}>
                                {statusCfg.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={result.matchScore} className="h-2 w-16" />
                                <span className={`text-xs font-semibold ${getMatchScoreTextColor(result.matchScore)}`}>
                                  {result.matchScore}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${riskCfg.color} ${riskCfg.bgColor} border text-xs`}>
                                {riskCfg.icon} {riskCfg.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">{mismatchLabels}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {result.aiExplanation || <span className="italic text-slate-400">No AI explanation</span>}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50"
                                onClick={() => {
                                  setSelectedResult(result);
                                  setDetailOpen(true);
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resolved Tab */}
        <TabsContent value="resolved">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Resolved Items
                <Badge variant="secondary" className="ml-2 bg-emerald-50 text-emerald-700">
                  {filteredResults.filter((r) => r.resolved).length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table style={{ minWidth: 1000 }}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Invoice #</TableHead>
                      <TableHead className="w-[100px]">Date</TableHead>
                      <TableHead className="w-[140px]">Source GSTIN</TableHead>
                      <TableHead className="w-[140px]">Matched GSTIN</TableHead>
                      <TableHead className="w-[130px]">Match Status</TableHead>
                      <TableHead className="w-[120px]">Match Score</TableHead>
                      <TableHead className="w-[100px]">Risk Level</TableHead>
                      <TableHead className="w-[140px]">Mismatches</TableHead>
                      <TableHead className="w-[200px]">AI Explanation</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResults
                      .filter((r) => r.resolved)
                      .map((result) => {
                        const statusCfg = MATCH_STATUS_CONFIG[result.matchStatus];
                        const invoice = result.invoice;
                        const riskLevel = invoice?.riskLevel ?? 'low';
                        const riskCfg = RISK_LEVEL_CONFIG[riskLevel];
                        const parsedMismatches = parseMismatches(result.mismatches);
                        const mismatchLabels = parsedMismatches.length > 0
                          ? parsedMismatches.map((m) => formatFieldName(m.field)).join(', ')
                          : 'None';

                        return (
                          <TableRow key={result.id} className="hover:bg-accent/40 transition-colors opacity-75">
                            <TableCell className="font-medium text-sm">{invoice?.invoiceNumber || '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {invoice?.invoiceDate
                                ? new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                                : '—'}
                            </TableCell>
                            <TableCell className="text-xs font-mono">{result.sourceGstin || '—'}</TableCell>
                            <TableCell className="text-xs font-mono">{result.matchedGstin || '—'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${statusCfg.color} ${statusCfg.bgColor} border text-xs`}>
                                {statusCfg.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={result.matchScore} className="h-2 w-16" />
                                <span className={`text-xs font-semibold ${getMatchScoreTextColor(result.matchScore)}`}>
                                  {result.matchScore}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${riskCfg.color} ${riskCfg.bgColor} border text-xs`}>
                                {riskCfg.icon} {riskCfg.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">{mismatchLabels}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {result.aiExplanation || <span className="italic text-slate-400">No AI explanation</span>}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50"
                                onClick={() => {
                                  setSelectedResult(result);
                                  setDetailOpen(true);
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== Detail Dialog ===== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedResult && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-emerald-600" />
                  Reconciliation Detail
                  {selectedResult.resolved && (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 ml-2">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Resolved
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  Invoice {selectedResult.invoice?.invoiceNumber || selectedResult.invoiceId} —{' '}
                  {MATCH_STATUS_CONFIG[selectedResult.matchStatus]?.label}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                {/* Side-by-side: Books vs GSTR */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Books Side */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                      <ArrowRight className="h-4 w-4 text-emerald-600" />
                      Books Data
                    </h4>
                    <Card className="border-emerald-200">
                      <CardContent className="p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Invoice #</span>
                          <span className="font-medium">{selectedResult.invoice?.invoiceNumber || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Date</span>
                          <span className="font-medium">
                            {selectedResult.invoice?.invoiceDate
                              ? new Date(selectedResult.invoice.invoiceDate).toLocaleDateString('en-IN')
                              : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Seller GSTIN</span>
                          <span className="font-mono text-xs">{selectedResult.invoice?.sellerGstin || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Buyer GSTIN</span>
                          <span className="font-mono text-xs">{selectedResult.invoice?.buyerGstin || '—'}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Taxable Value</span>
                          <span className="font-medium">{formatCurrency(selectedResult.invoice?.taxableValue ?? 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">CGST</span>
                          <span className="font-medium">{formatCurrency(selectedResult.invoice?.cgst ?? 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">SGST</span>
                          <span className="font-medium">{formatCurrency(selectedResult.invoice?.sgst ?? 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">IGST</span>
                          <span className="font-medium">{formatCurrency(selectedResult.invoice?.igst ?? 0)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground font-semibold">Total Amount</span>
                          <span className="font-bold text-emerald-700">
                            {formatCurrency(selectedResult.invoice?.totalAmount ?? 0)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* GSTR Side */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-purple-600" />
                      GSTR-2B Data
                    </h4>
                    <Card className="border-purple-200">
                      <CardContent className="p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Source GSTIN</span>
                          <span className="font-mono text-xs">{selectedResult.sourceGstin || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Matched GSTIN</span>
                          <span className="font-mono text-xs">{selectedResult.matchedGstin || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Source Type</span>
                          <span className="font-medium capitalize">{selectedResult.sourceType || '—'}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Match Status</span>
                          <Badge
                            variant="outline"
                            className={`${MATCH_STATUS_CONFIG[selectedResult.matchStatus]?.color} ${MATCH_STATUS_CONFIG[selectedResult.matchStatus]?.bgColor} border text-xs`}
                          >
                            {MATCH_STATUS_CONFIG[selectedResult.matchStatus]?.label}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Match Score</span>
                          <div className="flex items-center gap-2">
                            <Progress value={selectedResult.matchScore} className="h-2 w-16" />
                            <span className={`text-xs font-semibold ${getMatchScoreTextColor(selectedResult.matchScore)}`}>
                              {selectedResult.matchScore}/100
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Risk Level</span>
                          <Badge
                            variant="outline"
                            className={`${RISK_LEVEL_CONFIG[selectedResult.invoice?.riskLevel ?? 'low']?.color} ${RISK_LEVEL_CONFIG[selectedResult.invoice?.riskLevel ?? 'low']?.bgColor} border text-xs`}
                          >
                            {RISK_LEVEL_CONFIG[selectedResult.invoice?.riskLevel ?? 'low']?.icon}{' '}
                            {RISK_LEVEL_CONFIG[selectedResult.invoice?.riskLevel ?? 'low']?.label}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Mismatches List */}
                {parseMismatches(selectedResult.mismatches).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Mismatches Detected
                    </h4>
                    <Card className="border-red-200">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {parseMismatches(selectedResult.mismatches).map((m, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm">
                              <div className="flex items-center justify-center h-6 w-6 rounded-full bg-red-50 shrink-0">
                                <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{formatFieldName(m.field)}</p>
                              </div>
                              <div className="flex items-center gap-4 text-xs">
                                <div className="text-center">
                                  <p className="text-muted-foreground">Books</p>
                                  <p className="font-semibold text-emerald-700">{formatCurrency(m.books)}</p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                <div className="text-center">
                                  <p className="text-muted-foreground">GSTR</p>
                                  <p className="font-semibold text-red-700">{formatCurrency(m.gstr)}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-muted-foreground">Diff</p>
                                  <p className="font-semibold text-amber-700">
                                    {formatCurrency(Math.abs(m.books - m.gstr))}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">
                          {generateMismatchExplanation(
                            parseMismatches(selectedResult.mismatches).map((m) => m.field === 'totalAmount' ? 'amount_mismatch' : 'tax_mismatch')
                          )}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* AI Explanation */}
                {selectedResult.aiExplanation && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-purple-500" />
                      AI-Generated Explanation
                    </h4>
                    <Card className="border-purple-200 bg-purple-50/30">
                      <CardContent className="p-4">
                        <p className="text-sm leading-relaxed">{selectedResult.aiExplanation}</p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Resolution Section */}
                {!selectedResult.resolved && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground">Resolve This Item</h4>
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        {/* Assign to Team Member */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Assign to Team Member</label>
                          <Select value={assignedTo} onValueChange={setAssignedTo}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select team member..." />
                            </SelectTrigger>
                            <SelectContent>
                              {TEAM_MEMBERS.map((m) => (
                                <SelectItem key={m.id} value={m.name}>
                                  {m.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Notes */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Add Notes</label>
                          <Textarea
                            placeholder="Add resolution notes..."
                            value={resolveNote}
                            onChange={(e) => setResolveNote(e.target.value)}
                            className="min-h-[80px]"
                          />
                        </div>

                        <Button
                          onClick={handleResolve}
                          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Resolve
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Already resolved info */}
                {selectedResult.resolved && (
                  <Card className="border-emerald-200 bg-emerald-50/30">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <div>
                          <p className="font-medium text-emerald-800">This item has been resolved</p>
                          <p className="text-xs text-muted-foreground">
                            Resolved by {selectedResult.resolvedBy || 'Unknown'}
                            {selectedResult.resolvedAt && (
                              <> &middot; {new Date(selectedResult.resolvedAt).toLocaleDateString('en-IN')}</>
                            )}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setDetailOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
