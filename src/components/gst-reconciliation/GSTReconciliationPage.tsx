'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — GST Reconciliation Engine Dashboard (Premium)
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
//      • VEYRO AI Drawer (auto-fix panel, alternatives, score breakdown)
//
// Quality: Stripe + Linear + Vercel grade.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, AlertTriangle, TrendingUp, CheckCircle2,
  FileText, RefreshCw, Sparkles, Loader2, Download, X,
  Wifi, WifiOff, FlaskConical, ChevronDown, ChevronUp,
  Database, History, ExternalLink, Plug,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useOrg } from '@/contexts/OrgContext';
import { useApp } from '@/contexts/AppContext';
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

// ─── GST Status + Sync Job types (mirror /api/gst/status + /api/gst/sync-jobs) ──

type GSPMode = 'live' | 'sandbox' | 'demo' | 'not_connected';

interface GstStatus {
  mode: GSPMode;
  modeLabel: string;
  providerKey: string;
  providerName: string;
  providerDisplayName: string;
  gstin: string | null;
  legalName: string | null;
  tradeName: string | null;
  lastTestOk: boolean | null;
  lastTestedAt: string | null;
  lastTestMessage: string | null;
  lastSyncAt: string | null;
  tokenExpiry: string | null;
  tokenExpired: boolean;
  configId: string | null;
}

interface SyncJobRow {
  id: string;
  gstin: string;
  period: string;
  providerKey: string;
  mode: string;
  status: string;
  trigger: string;
  recordsFetched: number;
  recordsImported: number;
  recordsChanged: number;
  recordsRemoved: number;
  durationMs: number | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// Mode → badge classes (mirrors server provider-mode.ts).
function modeBadgeClass(mode: GSPMode): string {
  switch (mode) {
    case 'live':
      // Emerald allowed ONLY for the LIVE success badge (per GREEN
      // NEUTRALIZATION CASCADE exception).
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'sandbox':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'demo':
      return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
    case 'not_connected':
      return 'bg-red-500/15 text-red-400 border-red-500/30';
  }
}

function modeIcon(mode: GSPMode) {
  switch (mode) {
    case 'live':
      return <Wifi className="h-3.5 w-3.5" />;
    case 'sandbox':
      return <FlaskConical className="h-3.5 w-3.5" />;
    case 'demo':
      return <Sparkles className="h-3.5 w-3.5" />;
    case 'not_connected':
      return <WifiOff className="h-3.5 w-3.5" />;
  }
}

function fmtSyncDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

// ─── Main component ──────────────────────────────────────────────────────────

export function GSTReconciliationPage() {
  const { organization } = useOrg();
  const { setPendingSettingsSection, setCurrentView } = useApp();
  const organizationId = organization?.id ?? '';
  const [runs, setRuns] = useState<RunListEntry[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [running, setRunning] = useState(false);

  const [gstin, setGstin] = useState('27AAACR5058K1Z5');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));

  // ── GST connection status + sync center state ──
  // ONE source of truth — fetched from /api/gst/status. The mode badge
  // below always reflects this. NEVER show "Connected" + "Not connected"
  // at the same time.
  const [gstStatus, setGstStatus] = useState<GstStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [syncJobs, setSyncJobs] = useState<SyncJobRow[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncPeriod, setSyncPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [lastSyncSummary, setLastSyncSummary] = useState<{
    recordsFetched: number;
    recordsImported: number;
    recordsChanged: number;
    durationMs: number;
    mode: string;
  } | null>(null);

  // ── Data-source badge for the most recent reconciliation run ──
  // After handleRun() resolves, this holds the modeLabel returned by
  // /api/gst-reconciliation/run so the result panel can show
  // "Data source: DEMO / SANDBOX / LIVE".
  const [lastRunModeLabel, setLastRunModeLabel] = useState<string | null>(null);

  // ── Load GST status (canonical) ──
  const loadStatus = useCallback(async () => {
    if (!organizationId) {
      setLoadingStatus(false);
      return;
    }
    setLoadingStatus(true);
    try {
      const res = await fetchWithTimeout(
        `/api/gst/status?organizationId=${encodeURIComponent(organizationId)}`,
      );
      const data = await res.json();
      if (data.ok && data.status) setGstStatus(data.status);
    } catch {
      /* non-fatal — UI shows a neutral "unknown" state */
    } finally {
      setLoadingStatus(false);
    }
  }, [organizationId]);

  // ── Load sync jobs (history) ──
  const loadSyncJobs = useCallback(async () => {
    if (!organizationId) {
      setLoadingJobs(false);
      return;
    }
    setLoadingJobs(true);
    try {
      const res = await fetchWithTimeout(
        `/api/gst/sync-jobs?organizationId=${encodeURIComponent(organizationId)}&limit=10`,
      );
      const data = await res.json();
      if (data.ok && Array.isArray(data.jobs)) setSyncJobs(data.jobs);
    } catch {
      /* non-fatal */
    } finally {
      setLoadingJobs(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadStatus();
    void loadSyncJobs();
  }, [loadStatus, loadSyncJobs]);

  // ── Sync GSTR-2B now ──
  const handleSyncNow = async () => {
    if (!organizationId) return;
    if (gstStatus?.mode === 'not_connected') {
      toast.error('Connect a GSP provider in Settings first.');
      return;
    }
    setSyncing(true);
    setLastSyncSummary(null);
    try {
      const res = await fetchWithTimeout('/api/gst/sync-2b', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, period: syncPeriod }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Sync failed.');
      }
      setLastSyncSummary({
        recordsFetched: data.summary.recordsFetched,
        recordsImported: data.summary.recordsImported,
        recordsChanged: data.summary.recordsChanged,
        durationMs: data.summary.durationMs,
        mode: data.summary.mode,
      });
      toast.success(
        `Sync complete (${data.summary.mode.toUpperCase()}) — ` +
        `${data.summary.recordsFetched} fetched, ` +
        `${data.summary.recordsImported} imported.`,
      );
      // Refresh status (lastSyncAt) + jobs list.
      await Promise.all([loadStatus(), loadSyncJobs()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  // ── Navigate to Settings → GST section ──
  const goToSettingsGst = useCallback(() => {
    setPendingSettingsSection('gst');
    setCurrentView('settings');
  }, [setPendingSettingsSection, setCurrentView]);

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
    setLastRunModeLabel(null);
    try {
      // NOTE: We intentionally do NOT pass `gspProvider: 'mock'` here. The
      // backend (/api/gst-reconciliation/run) resolves the provider from
      // the org's saved config (live/sandbox/demo) via getGSPProviderForOrg().
      // The response now includes `modeLabel` so we can badge the result
      // accurately (LIVE / SANDBOX / DEMO).
      const res = await fetchWithTimeout('/api/gst-reconciliation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, gstin, period }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to run reconciliation');
      // Persist the data-source label so the run-result panel can show a
      // "Data source: DEMO/SANDBOX/LIVE" badge.
      const modeLabel = data.modeLabel || (data.mode ? data.mode.toUpperCase() : 'DEMO');
      setLastRunModeLabel(modeLabel);
      toast.success(
        `Reconciliation complete (${modeLabel}) — ` +
        `${data.summary.matched} matched, ${data.summary.unmatched} mismatches`,
      );
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

      {/* ── Sync Center panel ── */}
      <SyncCenter
        gstStatus={gstStatus}
        loadingStatus={loadingStatus}
        syncJobs={syncJobs}
        loadingJobs={loadingJobs}
        syncing={syncing}
        syncPeriod={syncPeriod}
        onSyncPeriodChange={setSyncPeriod}
        onSyncNow={handleSyncNow}
        onGoToSettings={goToSettingsGst}
        historyOpen={historyOpen}
        onToggleHistory={() => setHistoryOpen((v) => !v)}
        lastSyncSummary={lastSyncSummary}
        onRefresh={() => {
          void loadStatus();
          void loadSyncJobs();
        }}
      />

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
            <GspProviderCell gstStatus={gstStatus} loading={loadingStatus} onGoToSettings={goToSettingsGst} />
          </div>
        </div>
        {/* Data-source badge for the most recent run */}
        {lastRunModeLabel && (
          <div className="mt-4 flex items-center gap-2 border-t border-[#1F1F1F] pt-4">
            <span className="gst-label">Last run data source:</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                lastRunModeLabel === 'LIVE'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : lastRunModeLabel === 'SANDBOX'
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
              }`}
            >
              {lastRunModeLabel === 'LIVE' ? (
                <Wifi className="h-3 w-3" />
              ) : lastRunModeLabel === 'SANDBOX' ? (
                <FlaskConical className="h-3 w-3" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {lastRunModeLabel}
            </span>
          </div>
        )}
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

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC CENTER — premium panel above the new-run form
// ═══════════════════════════════════════════════════════════════════════════════
//
// ONE source of truth — the connection-state badge reflects `gstStatus.mode`
// from /api/gst/status. NEVER shows contradictory states. When NOT_CONNECTED,
// all live-data panels (last sync, history) are hidden and a prominent
// "Connect GSTN" CTA is shown instead.
//
// Layout:
//   1. Header row  — Connection state badge + provider name + Sync Now CTA
//   2. If NOT_CONNECTED  → "Connect GSTN" CTA card (links to Settings → GST)
//   3. If connected      → Last-sync info + period picker + Sync result
//   4. Expandable history (last 10 jobs) — only when connected
// ═══════════════════════════════════════════════════════════════════════════════

function SyncCenter({
  gstStatus, loadingStatus, syncJobs, loadingJobs, syncing, syncPeriod,
  onSyncPeriodChange, onSyncNow, onGoToSettings, historyOpen, onToggleHistory,
  lastSyncSummary, onRefresh,
}: {
  gstStatus: GstStatus | null;
  loadingStatus: boolean;
  syncJobs: SyncJobRow[];
  loadingJobs: boolean;
  syncing: boolean;
  syncPeriod: string;
  onSyncPeriodChange: (v: string) => void;
  onSyncNow: () => void;
  onGoToSettings: () => void;
  historyOpen: boolean;
  onToggleHistory: () => void;
  lastSyncSummary: {
    recordsFetched: number;
    recordsImported: number;
    recordsChanged: number;
    durationMs: number;
    mode: string;
  } | null;
  onRefresh: () => void;
}) {
  const mode: GSPMode = gstStatus?.mode ?? 'not_connected';
  const isConnected = mode !== 'not_connected';
  const lastJob = syncJobs[0] ?? null;

  return (
    <div className="gst-card mb-6">
      {/* Header row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#3B82F6]/20 to-[#3B82F6]/5">
            <Database className="h-4 w-4 text-[#60A5FA]" />
          </div>
          <div>
            <h2 className="gst-card-title flex items-center gap-2 text-white">
              Sync Center
              {loadingStatus ? (
                <span className="inline-block h-3 w-16 animate-pulse rounded bg-[#181818]" />
              ) : (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${modeBadgeClass(mode)}`}
                >
                  {modeIcon(mode)}
                  {gstStatus?.modeLabel ?? 'NOT CONNECTED'}
                </span>
              )}
            </h2>
            <p className="gst-description mt-0.5 text-zinc-400">
              Fetch GSTR-2B from {gstStatus?.providerDisplayName ?? 'your GSP'} before reconciling.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="gst-btn gst-btn-ghost h-9 gap-1.5 text-zinc-400 hover:text-white"
            aria-label="Refresh status"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          {isConnected && (
            <button
              onClick={onSyncNow}
              disabled={syncing}
              className="gst-btn gst-btn-primary h-9 gap-2"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>
      </div>

      {/* ── NOT CONNECTED → prominent CTA ── */}
      {!loadingStatus && !isConnected && (
        <div className="mt-5 rounded-lg border border-red-500/20 bg-red-500/5 p-5">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="gst-card-title text-red-300">No GSP provider connected</p>
                <p className="gst-description mt-1 text-zinc-400">
                  Reconciliation runs in <span className="text-zinc-200">demo mode</span> with
                  simulated sample data. Connect a real GSP to fetch live GSTR-2B from GSTN.
                </p>
              </div>
            </div>
            <button
              onClick={onGoToSettings}
              className="gst-btn gst-btn-primary h-9 shrink-0 gap-2"
            >
              <Plug className="h-4 w-4" />
              Connect GSTN
            </button>
          </div>
        </div>
      )}

      {/* ── Loading state ── */}
      {loadingStatus && (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-[#181818]" />
              <div className="h-5 w-32 animate-pulse rounded bg-[#141414]" />
            </div>
          ))}
        </div>
      )}

      {/* ── Connected → last-sync info + period picker + result ── */}
      {!loadingStatus && isConnected && (
        <>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="gst-label mb-1">Provider</p>
              <p className="text-sm text-white">{gstStatus?.providerDisplayName ?? '—'}</p>
              {gstStatus?.gstin && (
                <p className="gst-caption mt-0.5 font-mono text-zinc-500">{gstStatus.gstin}</p>
              )}
            </div>
            <div>
              <p className="gst-label mb-1">Last Sync</p>
              {gstStatus?.lastSyncAt ? (
                <>
                  <p className="text-sm text-white">{fmtRelative(gstStatus.lastSyncAt)}</p>
                  <p className="gst-caption mt-0.5 text-zinc-500">{fmtSyncDate(gstStatus.lastSyncAt)}</p>
                </>
              ) : lastJob ? (
                <>
                  <p className="text-sm text-white">{fmtRelative(lastJob.completedAt ?? lastJob.createdAt)}</p>
                  <p className="gst-caption mt-0.5 text-zinc-500">
                    {lastJob.recordsFetched} records · {lastJob.durationMs ?? 0}ms
                  </p>
                </>
              ) : (
                <p className="text-sm text-zinc-500">Never synced</p>
              )}
            </div>
            <div>
              <p className="gst-label mb-1">Sync Period</p>
              <Input
                type="month"
                value={syncPeriod}
                onChange={(e) => onSyncPeriodChange(e.target.value)}
                className="h-9 text-sm"
                disabled={syncing}
              />
            </div>
          </div>

          {/* Sync result (after Sync Now) */}
          {lastSyncSummary && (
            <div className="mt-4 rounded-md border border-[#1F1F1F] bg-[#0F1115] p-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="gst-label">Fetched</p>
                  <p className="text-sm font-semibold text-white">{lastSyncSummary.recordsFetched}</p>
                </div>
                <div>
                  <p className="gst-label">Imported</p>
                  <p className="text-sm font-semibold text-white">{lastSyncSummary.recordsImported}</p>
                </div>
                <div>
                  <p className="gst-label">Changed</p>
                  <p className="text-sm font-semibold text-white">{lastSyncSummary.recordsChanged}</p>
                </div>
                <div>
                  <p className="gst-label">Duration</p>
                  <p className="text-sm font-semibold text-white">{lastSyncSummary.durationMs}ms</p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 border-t border-[#1F1F1F] pt-2">
                <span className={`gst-status ${
                  lastSyncSummary.mode === 'live' ? 'gst-status-success' :
                  lastSyncSummary.mode === 'sandbox' ? 'gst-status-warning' :
                  'gst-status-neutral'
                }`}>
                  {lastSyncSummary.mode.toUpperCase()}
                </span>
                <span className="gst-caption text-zinc-500">
                  {lastSyncSummary.mode === 'live'
                    ? 'Fetched from production GSTN.'
                    : lastSyncSummary.mode === 'sandbox'
                      ? 'Fetched from GSP sandbox environment.'
                      : 'Demo mode — simulated sample data.'}
                </span>
              </div>
            </div>
          )}

          {/* Expandable history */}
          <div className="mt-4 border-t border-[#1F1F1F] pt-4">
            <button
              onClick={onToggleHistory}
              className="gst-btn gst-btn-ghost h-8 gap-1.5 px-2 text-zinc-400 hover:text-white"
              aria-expanded={historyOpen}
            >
              {historyOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <History className="h-3.5 w-3.5" />
              View Sync History {syncJobs.length > 0 && `(${syncJobs.length})`}
            </button>
            <AnimatePresence initial={false}>
              {historyOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3">
                    {loadingJobs ? (
                      <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="h-9 w-full animate-pulse rounded bg-[#141414]" />
                        ))}
                      </div>
                    ) : syncJobs.length === 0 ? (
                      <p className="gst-description py-6 text-center text-zinc-500">
                        No sync jobs yet. Click <strong className="text-zinc-300">Sync Now</strong> to fetch GSTR-2B.
                      </p>
                    ) : (
                      <div className="gst-table-wrap max-h-96 overflow-auto">
                        <table className="gst-table">
                          <thead>
                            <tr>
                              <th>Period</th>
                              <th>Provider</th>
                              <th>Mode</th>
                              <th>Status</th>
                              <th className="text-right">Records</th>
                              <th className="text-right">Duration</th>
                              <th>Timestamp</th>
                            </tr>
                          </thead>
                          <tbody>
                            {syncJobs.map((j) => (
                              <tr key={j.id}>
                                <td className="font-mono text-[12px] text-zinc-300">{j.period}</td>
                                <td className="text-zinc-300">{j.providerKey}</td>
                                <td>
                                  <span className={`gst-status ${
                                    j.mode === 'live' ? 'gst-status-success' :
                                    j.mode === 'sandbox' ? 'gst-status-warning' :
                                    'gst-status-neutral'
                                  }`}>
                                    {j.mode.toUpperCase()}
                                  </span>
                                </td>
                                <td>
                                  {j.status === 'completed' ? (
                                    <span className="gst-status gst-status-success">
                                      <CheckCircle2 className="h-3 w-3" /> Done
                                    </span>
                                  ) : j.status === 'running' ? (
                                    <span className="gst-status gst-status-info">
                                      <Loader2 className="h-3 w-3 animate-spin" /> Running
                                    </span>
                                  ) : j.status === 'failed' ? (
                                    <span className="gst-status gst-status-danger">
                                      <X className="h-3 w-3" /> Failed
                                    </span>
                                  ) : (
                                    <span className="gst-status gst-status-neutral">{j.status}</span>
                                  )}
                                </td>
                                <td className="text-right font-mono text-[12px] text-zinc-300">
                                  {j.recordsFetched}
                                  {j.recordsImported > 0 && (
                                    <span className="text-zinc-500"> (+{j.recordsImported})</span>
                                  )}
                                </td>
                                <td className="text-right font-mono text-[12px] text-zinc-400">
                                  {j.durationMs != null ? `${j.durationMs}ms` : '—'}
                                </td>
                                <td className="whitespace-nowrap font-mono text-[12px] text-zinc-400">
                                  {fmtSyncDate(j.completedAt ?? j.startedAt ?? j.createdAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GSP PROVIDER CELL — replaces the hard-coded "Mock GSP (Sandbox)" display in
// the new-run form. Shows the ACTUAL resolved provider name + mode badge from
// /api/gst/status. If mode is 'demo', shows "Demo (offline sample data)". If
// 'not_connected', shows "Not connected" + a link to Settings.
// ═══════════════════════════════════════════════════════════════════════════════

function GspProviderCell({
  gstStatus, loading, onGoToSettings,
}: {
  gstStatus: GstStatus | null;
  loading: boolean;
  onGoToSettings: () => void;
}) {
  if (loading) {
    return (
      <div className="flex h-10 items-center rounded-lg border border-[#2A2E36] bg-[#0F1115] px-3">
        <div className="h-4 w-32 animate-pulse rounded bg-[#181818]" />
      </div>
    );
  }

  const mode: GSPMode = gstStatus?.mode ?? 'not_connected';
  const displayName =
    mode === 'not_connected'
      ? 'Not connected'
      : mode === 'demo'
        ? 'Demo (offline sample data)'
        : gstStatus?.providerDisplayName ?? 'GSP Provider';

  return (
    <div className="flex h-10 items-center justify-between rounded-lg border border-[#2A2E36] bg-[#0F1115] px-3 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        {mode === 'live' ? (
          <Wifi className="h-4 w-4 shrink-0 text-emerald-400" />
        ) : mode === 'sandbox' ? (
          <FlaskConical className="h-4 w-4 shrink-0 text-amber-400" />
        ) : mode === 'demo' ? (
          <Sparkles className="h-4 w-4 shrink-0 text-zinc-400" />
        ) : (
          <WifiOff className="h-4 w-4 shrink-0 text-red-400" />
        )}
        <span className="truncate text-zinc-200">{displayName}</span>
      </div>
      {mode === 'not_connected' ? (
        <button
          onClick={onGoToSettings}
          className="ml-2 flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-blue-400 hover:text-blue-300"
        >
          Connect <ExternalLink className="h-3 w-3" />
        </button>
      ) : (
        <span
          className={`ml-2 inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${modeBadgeClass(mode)}`}
        >
          {gstStatus?.modeLabel ?? mode.toUpperCase()}
        </span>
      )}
    </div>
  );
}

export default GSTReconciliationPage;
