'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — GST Reconciliation Engine Dashboard (Premium)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Production-grade GSTR-2B vs Books reconciliation dashboard.
//
// Sections:
//   1. Header with Run Reconciliation button
//   2. New run form (GSTIN, Period, GSP Provider)
//   3. Recent Runs pill grid
//   4. RunDetail:
//      • Summary cards (6) with count-up animations
//      • AI CFO Summary card (one-click PDF)
//      • Timeline chart (monthly trend)
//      • Vendor Compliance Scoreboard
//      • Match Distribution + ITC Position
//      • Advanced filters (status, resolved, search, vendor, amount, confidence)
//      • Bulk actions bar (resolve/export/email/review)
//      • Virtualized table (50k rows via react-window)
//      • Oracle AI Drawer (auto-fix panel, alternatives, score breakdown)
//
// Quality: Stripe + Linear + Vercel grade.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck, AlertTriangle, TrendingUp, CheckCircle2,
  FileText, RefreshCw, Sparkles, Loader2, Zap, Download, X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useOrg } from '@/contexts/OrgContext';
import { fetchWithTimeout } from '@/lib/async';
import {
  type RunSummary, type MatchRow, type AIReconciliationSummary,
  type VendorScore, type TimelineEntry,
  SummaryCard, MatchDistributionCard, ITCRiskCard, AISummaryCard,
  TimelineChart, VendorScoreboard, BulkActionsBar, AdvancedFilters,
  type FilterState, RunDetailSkeleton, fmtINR, fmtRelative,
} from './parts';
import { VirtualizedReconciliationTable } from './ReconciliationTable';
import { OracleDrawer } from './OracleDrawer';

interface RunListEntry {
  id: string;
  gstin: string;
  period: string;
  gspProvider: string;
  status: string;
  matchPercent: number;
  potentialITCLoss: number;
  totalBooks: number;
  total2B: number;
  createdAt: string;
}

// ─── Main component ──────────────────────────────────────────────────────────

export function GSTReconciliationPage() {
  const { organization } = useOrg();
  const organizationId = organization?.id ?? '';
  const [runs, setRuns] = useState<RunListEntry[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [running, setRunning] = useState(false);

  const [gstin, setGstin] = useState('27AAACR5058K1Z5');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));

  const loadRuns = useCallback(async () => {
    if (!organizationId) return;
    setLoadingRuns(true);
    // Retry up to 3 times — dev server may be compiling the route on first hit.
    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetchWithTimeout(`/api/gst-reconciliation/runs?organizationId=${encodeURIComponent(organizationId)}`);
        const data = await res.json();
        if (data.runs) {
          setRuns(data.runs);
          if (data.runs.length > 0 && !activeRunId) {
            setActiveRunId(data.runs[0].id);
          }
        }
        setLoadingRuns(false);
        return;
      } catch (err) {
        if (i < 2) {
          await new Promise((r) => setTimeout(r, 600 * (i + 1)));
          continue;
        }
        console.warn('Runs list unavailable:', err);
        setLoadingRuns(false);
      }
    }
  }, [organizationId, activeRunId]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const handleRun = async () => {
    if (!organizationId || !gstin || !period) return;
    setRunning(true);
    try {
      const res = await fetchWithTimeout('/api/gst-reconciliation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, gstin, period, gspProvider: 'mock' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to run reconciliation');
      toast.success(`Reconciliation complete — ${data.summary.matched} matched, ${data.summary.unmatched} mismatches`);
      await loadRuns();
      if (data.runId) setActiveRunId(data.runId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reconciliation failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="gst-container-wide py-6">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#3B82F6]/20 to-[#3B82F6]/5">
              <ShieldCheck className="h-5 w-5 text-[#60A5FA]" />
            </div>
            <h1 className="gst-page-title">GST Reconciliation</h1>
          </div>
          <p className="gst-description mt-1.5">
            Reconcile purchase invoices against GSTR-2B. Identify mismatches, protect ITC, and resolve discrepancies before filing.
          </p>
        </div>
        <Button
          onClick={handleRun}
          disabled={running || !gstin || !period}
          className="gst-btn gst-btn-primary gst-btn-lg"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {running ? 'Running...' : 'Run Reconciliation'}
        </Button>
      </div>

      {/* New run form */}
      <div className="gst-card gst-card-compact mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="gst-label mb-1.5 block">GSTIN</label>
            <Input
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="27AAACR5058K1Z5"
              className="h-10 font-mono text-sm"
            />
          </div>
          <div>
            <label className="gst-label mb-1.5 block">Period</label>
            <Input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="h-10 text-sm"
            />
          </div>
          <div>
            <label className="gst-label mb-1.5 block">GSP Provider</label>
            <div className="flex h-10 items-center rounded-lg border border-[#2A2E36] bg-[#0F1115] px-3 text-sm text-muted-foreground">
              <Zap className="mr-2 h-4 w-4 text-[#60A5FA]" />
              Mock GSP (Sandbox)
              <Badge variant="outline" className="ml-auto text-[11px]">Default</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Recent runs */}
      {runs.length > 0 && (
        <div className="mb-6">
          <h2 className="gst-section-title mb-3">Recent Runs</h2>
          <div className="flex flex-wrap gap-2">
            {runs.slice(0, 8).map((r, i) => (
              <motion.button
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setActiveRunId(r.id)}
                className={`gst-card gst-card-compact gst-card-hover text-left transition-all ${
                  activeRunId === r.id ? 'border-[#2563EB] bg-[#2563EB]/[0.04]' : ''
                }`}
                style={{ padding: '12px 16px' }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{r.period}</span>
                  <Badge
                    variant="outline"
                    className="text-[11px]"
                    style={{
                      color: r.matchPercent >= 85 ? '#3B82F6' : r.matchPercent >= 60 ? '#F59E0B' : '#EF4444',
                      borderColor: 'currentColor',
                    }}
                  >
                    {r.matchPercent}% match
                  </Badge>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {r.totalBooks + r.total2B} records · {fmtINR(r.potentialITCLoss)} at risk
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{fmtRelative(r.createdAt)}</div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {activeRunId ? (
        <RunDetail runId={activeRunId} organizationId={organizationId} />
      ) : (
        <div className="gst-empty-state">
          <div className="gst-empty-state-icon">
            <ShieldCheck className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="gst-empty-state-title">No reconciliations yet</h3>
          <p className="gst-empty-state-desc">
            Run your first GSTR-2B reconciliation to identify mismatches, protect ITC, and ensure compliance before filing.
          </p>
          <div className="flex items-center gap-2">
            <button onClick={handleRun} disabled={running} className="gst-btn gst-btn-primary gst-btn-lg">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {running ? 'Running...' : 'Run First Reconciliation'}
            </button>
          </div>
          <div className="mt-6 max-w-md text-left">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              What gets compared
            </div>
            <ul className="space-y-1.5">
              {['GSTIN', 'Invoice Number', 'Invoice Date', 'Taxable Value', 'CGST / SGST / IGST / CESS', 'Total Amount'].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#60A5FA]" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Run Detail ──────────────────────────────────────────────────────────────

function RunDetail({ runId, organizationId }: { runId: string; organizationId: string }) {
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  // AI summary + vendor scores + timeline
  const [aiSummary, setAiSummary] = useState<AIReconciliationSummary | null>(null);
  const [vendors, setVendors] = useState<VendorScore[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [timelineTrend, setTimelineTrend] = useState<'improving' | 'declining' | 'stable' | 'insufficient_data'>('insufficient_data');
  const [timelineAvg, setTimelineAvg] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    resolved: 'all',
    search: '',
    vendor: '',
    minAmount: '',
    maxAmount: '',
    confidence: '',
  });
  const [limit] = useState(100);
  const [offset, setOffset] = useState(0);

  // Vendor options for the filter dropdown
  const vendorOptions = useMemoVendorOptions(vendors);

  const loadDetail = useCallback(async (append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.resolved !== 'all') params.set('resolved', filters.resolved);
      if (filters.search) params.set('search', filters.search);
      if (filters.vendor) params.set('vendor', filters.vendor);
      if (filters.minAmount) params.set('minAmount', filters.minAmount);
      if (filters.maxAmount) params.set('maxAmount', filters.maxAmount);
      if (filters.confidence) params.set('confidence', filters.confidence);
      params.set('limit', String(limit));
      params.set('offset', String(append ? offset : 0));
      const res = await fetchWithTimeout(`/api/gst-reconciliation/${runId}?${params.toString()}`);
      const data = await res.json();
      if (data.run) setSummary(data.run);
      if (data.matches) {
        setMatches(append ? (prev) => [...prev, ...data.matches] : data.matches);
      }
      if (data.pagination) setTotal(data.pagination.total);
    } catch (err) {
      console.warn('Run detail unavailable:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [runId, filters, limit, offset]);

  // Load detail on filter changes
  useEffect(() => {
    setOffset(0);
    void loadDetail(false);
  }, [loadDetail]);

  // Load AI summary + vendors + timeline (separate, less frequent)
  useEffect(() => {
    if (!summary) return;
    let cancelled = false;
    void (async () => {
      // Retry up to 3 times with backoff — in dev, the first request often
      // fails because Next.js is still compiling the route on-demand.
      const attempts = 3;
      for (let i = 0; i < attempts; i++) {
        try {
          const [sumRes, vendRes] = await Promise.all([
            fetchWithTimeout(`/api/gst-reconciliation/${runId}/summary`),
            fetchWithTimeout(`/api/gst-reconciliation/${runId}/vendors`),
          ]);
          if (cancelled) return;
          if (sumRes.ok) {
            const sd = await sumRes.json();
            if (sd.summary) setAiSummary(sd.summary);
          }
          if (vendRes.ok) {
            const vd = await vendRes.json();
            if (vd.vendors) setVendors(vd.vendors);
          }
          return; // success — stop retrying
        } catch (err) {
          if (cancelled) return;
          if (i < attempts - 1) {
            await new Promise((r) => setTimeout(r, 800 * (i + 1)));
            continue;
          }
          // Final failure — log as warning (not error) since this is non-blocking
          // and the user can still use the table without AI summary.
          console.warn('AI summary / vendors unavailable:', err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId, summary]);

  // Load timeline
  useEffect(() => {
    if (!organizationId || !summary) return;
    let cancelled = false;
    void (async () => {
      // Retry up to 3 times — dev server may be compiling the route.
      for (let i = 0; i < 3; i++) {
        try {
          const res = await fetchWithTimeout(
            `/api/gst-reconciliation/timeline?organizationId=${encodeURIComponent(organizationId)}&gstin=${encodeURIComponent(summary.gstin)}&months=6`,
          );
          if (cancelled) return;
          const data = await res.json();
          if (data.timeline) {
            setTimeline(data.timeline);
            setTimelineTrend(data.trend);
            setTimelineAvg(data.avgMatchPercent);
          }
          return;
        } catch (err) {
          if (cancelled) return;
          if (i < 2) {
            await new Promise((r) => setTimeout(r, 800 * (i + 1)));
            continue;
          }
          console.warn('Timeline unavailable:', err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId, summary]);

  // ── Handlers ──
  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const res = await fetchWithTimeout(`/api/gst-reconciliation/${runId}/export?format=${format}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gst-reconciliation-${summary?.gstin || 'run'}-${summary?.period || ''}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Export failed');
    }
  };

  const handlePdf = async () => {
    setPdfLoading(true);
    try {
      const res = await fetchWithTimeout(`/api/gst-reconciliation/${runId}/pdf`);
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gst-reconciliation-${summary?.gstin || 'run'}-${summary?.period || ''}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('PDF report downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'PDF export failed');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleResolve = async (matchId: string, resolved: boolean) => {
    setBusyId(matchId);
    try {
      const res = await fetchWithTimeout(`/api/gst-reconciliation/${runId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, resolved }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setMatches((prev) => prev.map((m) => m.id === matchId ? { ...m, resolved } : m));
      toast.success(resolved ? 'Marked as resolved' : 'Reopened');
    } catch {
      toast.error('Could not update status');
    } finally {
      setBusyId(null);
    }
  };

  // ── Bulk handlers ──
  const handleToggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected = matches.length > 0 && matches.every((m) => prev.has(m.id));
      if (allSelected) return new Set();
      return new Set(matches.map((m) => m.id));
    });
  }, [matches]);

  const handleClearSelection = () => setSelectedIds(new Set());

  const handleBulk = async (action: 'resolve' | 'reopen' | 'review' | 'email_supplier' | 'export_csv' | 'export_json') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetchWithTimeout(`/api/gst-reconciliation/${runId}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchIds: ids, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk action failed');

      // For exports, download the file
      if (action === 'export_csv' && data.exportData?.csv) {
        const blob = new Blob([data.exportData.csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.exportData.filename || `gst-reconciliation-selected.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${data.affected} matches as CSV`);
      } else if (action === 'export_json' && data.exportData) {
        const blob = new Blob([JSON.stringify(data.exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gst-reconciliation-selected.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${data.affected} matches as JSON`);
      } else if (action === 'email_supplier' && data.emailDrafts) {
        // Show email drafts (for demo, just show a toast with the count)
        toast.success(`Generated ${data.emailDrafts.length} email draft(s) — review and send manually`);
      } else {
        toast.success(`Bulk action "${action}" applied to ${data.affected} matches`);
        // Refresh matches
        void loadDetail(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk action failed');
    } finally {
      setBulkBusy(false);
      if (action === 'resolve' || action === 'reopen' || action === 'review') {
        handleClearSelection();
      }
    }
  };

  const handleLoadMore = () => {
    setOffset((prev) => prev + limit);
    void loadDetail(true);
  };

  const handleSelectVendor = (gstin: string | null) => {
    setFilters((prev) => ({ ...prev, vendor: gstin || '' }));
  };

  if (loading && !summary) {
    return <RunDetailSkeleton />;
  }

  if (!summary) {
    return <div className="gst-card">Run not found.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard icon={<TrendingUp className="h-4 w-4" />} label="Match %" value={`${summary.matchPercent}%`} tone="success" delay={0} />
        <SummaryCard icon={<AlertTriangle className="h-4 w-4" />} label="ITC at Risk" value={fmtINR(summary.potentialITCLoss)} tone={summary.potentialITCLoss > 0 ? 'danger' : 'neutral'} delay={0.05} />
        <SummaryCard icon={<CheckCircle2 className="h-4 w-4" />} label="Matched" value={String(summary.matched)} tone="success" delay={0.1} />
        <SummaryCard icon={<AlertTriangle className="h-4 w-4" />} label="Mismatches" value={String(summary.unmatched)} tone={summary.unmatched > 0 ? 'warning' : 'neutral'} delay={0.15} />
        <SummaryCard icon={<FileText className="h-4 w-4" />} label="Missing in Books" value={String(summary.missingInBooks)} tone={summary.missingInBooks > 0 ? 'danger' : 'neutral'} delay={0.2} />
        <SummaryCard icon={<FileText className="h-4 w-4" />} label="Missing in 2B" value={String(summary.missingIn2B)} tone={summary.missingIn2B > 0 ? 'danger' : 'neutral'} delay={0.25} />
      </div>

      {/* AI CFO Summary card + Timeline */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {aiSummary ? (
          <AISummaryCard
            summary={aiSummary}
            runId={runId}
            gstin={summary.gstin}
            period={summary.period}
            onPdf={handlePdf}
          />
        ) : (
          <div className="gst-card flex h-full items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-muted-foreground" />
              <p className="gst-caption">Generating AI summary...</p>
            </div>
          </div>
        )}
        <TimelineChart timeline={timeline} trend={timelineTrend} avgMatchPercent={timelineAvg} />
      </div>

      {/* Vendor scoreboard + Distribution + ITC */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <VendorScoreboard vendors={vendors} onSelectVendor={handleSelectVendor} selectedGstin={filters.vendor} />
        </div>
        <div className="lg:col-span-1">
          <MatchDistributionCard summary={summary} />
        </div>
        <div className="lg:col-span-1">
          <ITCRiskCard summary={summary} />
        </div>
      </div>

      {/* Bulk actions bar */}
      <BulkActionsBar
        selectedCount={selectedIds.size}
        onClear={handleClearSelection}
        onResolve={() => handleBulk('resolve')}
        onReopen={() => handleBulk('reopen')}
        onReview={() => handleBulk('review')}
        onEmail={() => handleBulk('email_supplier')}
        onExportCsv={() => handleBulk('export_csv')}
        onExportJson={() => handleBulk('export_json')}
        busy={bulkBusy}
      />

      {/* Filters + Export buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <AdvancedFilters
            filters={filters}
            onChange={setFilters}
            vendorOptions={vendorOptions}
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('csv')} className="gst-btn gst-btn-secondary gst-btn-sm">
            <Download className="h-3.5 w-3.5" /> All CSV
          </button>
          <button onClick={() => handleExport('json')} className="gst-btn gst-btn-secondary gst-btn-sm">
            <Download className="h-3.5 w-3.5" /> All JSON
          </button>
          <button onClick={handlePdf} disabled={pdfLoading} className="gst-btn gst-btn-primary gst-btn-sm">
            {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            CFO PDF
          </button>
        </div>
      </div>

      {/* Virtualized table */}
      <VirtualizedReconciliationTable
        matches={matches}
        selectedIds={selectedIds}
        onToggleRow={handleToggleRow}
        onToggleAll={handleToggleAll}
        onOpenMatch={(m) => setSelectedMatch(m)}
        onResolve={handleResolve}
        busyId={busyId}
        loading={loading}
        total={total}
        onLoadMore={handleLoadMore}
      />

      {/* Oracle drawer */}
      {selectedMatch && (
        <OracleDrawer
          match={selectedMatch}
          runId={runId}
          onClose={() => setSelectedMatch(null)}
          onResolved={(resolved) => {
            setMatches((prev) => prev.map((m) => m.id === selectedMatch.id ? { ...m, resolved } : m));
            setSelectedMatch((prev) => prev ? { ...prev, resolved } : null);
          }}
          onFixApplied={() => {
            // Refresh detail to pick up the new status
            void loadDetail(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useMemoVendorOptions(vendors: VendorScore[]): Array<{ gstin: string; name: string | null }> {
  return vendors.map((v) => ({ gstin: v.gstin, name: v.name }));
}

export default GSTReconciliationPage;
