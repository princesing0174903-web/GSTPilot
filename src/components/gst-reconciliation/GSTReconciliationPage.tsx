'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — GST Reconciliation Engine Dashboard
// ═══════════════════════════════════════════════════════════════════════════════
//
// A production-grade GSTR-2B vs Books reconciliation module.
//
// Features:
//   • Summary cards (Match %, ITC at Risk, Matched, Unmatched, Missing)
//   • Filters (status, resolved, search)
//   • Reconciliation table with sticky header + hover + status badges
//   • Oracle AI explanation per mismatch (rule-based, instant)
//   • Charts: match distribution donut + ITC at risk by status bar
//   • Export CSV / JSON
//   • Resolve / reopen mismatches
//
// Inspired by Stripe Dashboard + Linear + Mercury reconciliation UIs.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, AlertTriangle, TrendingUp, TrendingDown, FileCheck2,
  FileX2, Copy, CalendarClock, Search, Download, RefreshCw, Sparkles,
  X, CheckCircle2, Loader2, Zap, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useOrg } from '@/contexts/OrgContext';
import { fetchWithTimeout } from '@/lib/async';

// ─── Types ───────────────────────────────────────────────────────────────────

type MatchStatus =
  | 'perfect_match' | 'value_mismatch' | 'tax_mismatch' | 'date_mismatch'
  | 'gstin_mismatch' | 'missing_in_books' | 'missing_in_gstr2b' | 'duplicate';

interface RunSummary {
  id: string;
  gstin: string;
  period: string;
  gspProvider: string;
  status: string;
  totalBooks: number;
  total2B: number;
  matched: number;
  unmatched: number;
  missingInBooks: number;
  missingIn2B: number;
  duplicates: number;
  matchPercent: number;
  potentialITCLoss: number;
  totalTaxableValue: number;
  totalMatchedTax: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
}

interface MismatchField {
  field: string;
  booksValue?: string | number;
  gstr2bValue?: string | number;
  delta?: number;
}

interface MatchRow {
  id: string;
  status: MatchStatus;
  confidence: number;
  booksInvoiceId: string | null;
  booksInvoiceNo: string | null;
  booksInvoiceDate: string | null;
  booksSupplierGSTIN: string | null;
  booksTaxableValue: number;
  booksCGST: number;
  booksSGST: number;
  booksIGST: number;
  booksCESS: number;
  booksTotal: number;
  gstr2bInvoiceNo: string | null;
  gstr2bInvoiceDate: string | null;
  gstr2bSupplierGSTIN: string | null;
  gstr2bTaxableValue: number;
  gstr2bCGST: number;
  gstr2bSGST: number;
  gstr2bIGST: number;
  gstr2bCESS: number;
  gstr2bTotal: number;
  mismatchReasons: MismatchField[];
  itcAtRisk: number;
  aiExplanation: string | null;
  aiRecommendation: string | null;
  resolved: boolean;
}

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

// ─── Status metadata ─────────────────────────────────────────────────────────

const STATUS_META: Record<MatchStatus, { label: string; color: string; icon: typeof ShieldCheck }> = {
  perfect_match: { label: 'Perfect Match', color: 'success', icon: CheckCircle2 },
  value_mismatch: { label: 'Value Mismatch', color: 'warning', icon: TrendingDown },
  tax_mismatch: { label: 'Tax Mismatch', color: 'warning', icon: AlertTriangle },
  date_mismatch: { label: 'Date Mismatch', color: 'info', icon: CalendarClock },
  gstin_mismatch: { label: 'GSTIN Mismatch', color: 'danger', icon: AlertTriangle },
  missing_in_books: { label: 'Missing in Books', color: 'danger', icon: FileX2 },
  missing_in_gstr2b: { label: 'Missing in GSTR-2B', color: 'danger', icon: FileX2 },
  duplicate: { label: 'Duplicate', color: 'info', icon: Copy },
};

function fmtINR(n: number | null | undefined): string {
  if (n == null) return '—';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtRelative(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
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
    try {
      const res = await fetchWithTimeout(`/api/gst-reconciliation/runs?organizationId=${encodeURIComponent(organizationId)}`);
      const data = await res.json();
      if (data.runs) {
        setRuns(data.runs);
        if (data.runs.length > 0 && !activeRunId) {
          setActiveRunId(data.runs[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load runs:', err);
    } finally {
      setLoadingRuns(false);
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
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-[#3B82F6]" />
            <h1 className="gst-page-title">GST Reconciliation</h1>
          </div>
          <p className="gst-description mt-1">
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
            <div className="flex h-10 items-center rounded-lg border border-[#2A2E36] bg-[#0A0A0A] px-3 text-sm text-muted-foreground">
              <Zap className="mr-2 h-4 w-4 text-[#3B82F6]" />
              Mock GSP (Sandbox)
              <Badge variant="outline" className="ml-auto text-[10px]">Default</Badge>
            </div>
          </div>
        </div>
      </div>

      {runs.length > 0 && (
        <div className="mb-6">
          <h2 className="gst-section-title mb-3">Recent Runs</h2>
          <div className="flex flex-wrap gap-2">
            {runs.slice(0, 8).map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveRunId(r.id)}
                className={`gst-card gst-card-compact gst-card-hover text-left ${activeRunId === r.id ? 'border-[#2563EB]' : ''}`}
                style={{ padding: '12px 16px' }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{r.period}</span>
                  <Badge variant="outline" className="text-[10px]">{r.matchPercent}% match</Badge>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {r.totalBooks + r.total2B} records · {fmtINR(r.potentialITCLoss)} at risk
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{fmtRelative(r.createdAt)}</div>
              </button>
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
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#3B82F6]" />
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

function RunDetail({ runId, organizationId: _organizationId }: { runId: string; organizationId: string }) {
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [resolvedFilter, setResolvedFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedMatch, setSelectedMatch] = useState<MatchRow | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (resolvedFilter !== 'all') params.set('resolved', resolvedFilter);
      if (search) params.set('search', search);
      params.set('limit', '100');
      const res = await fetchWithTimeout(`/api/gst-reconciliation/${runId}?${params.toString()}`);
      const data = await res.json();
      if (data.run) setSummary(data.run);
      if (data.matches) setMatches(data.matches);
    } catch (err) {
      console.error('Failed to load run detail:', err);
    } finally {
      setLoading(false);
    }
  }, [runId, statusFilter, resolvedFilter, search]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

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

  const handleResolve = async (matchId: string, resolved: boolean) => {
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
    }
  };

  if (loading && !summary) {
    return <RunDetailSkeleton />;
  }

  if (!summary) {
    return <div className="gst-card">Run not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard icon={<TrendingUp className="h-4 w-4" />} label="Match %" value={`${summary.matchPercent}%`} tone="success" />
        <SummaryCard icon={<AlertTriangle className="h-4 w-4" />} label="ITC at Risk" value={fmtINR(summary.potentialITCLoss)} tone={summary.potentialITCLoss > 0 ? 'danger' : 'neutral'} />
        <SummaryCard icon={<CheckCircle2 className="h-4 w-4" />} label="Matched" value={String(summary.matched)} tone="success" />
        <SummaryCard icon={<AlertTriangle className="h-4 w-4" />} label="Mismatches" value={String(summary.unmatched)} tone={summary.unmatched > 0 ? 'warning' : 'neutral'} />
        <SummaryCard icon={<FileX2 className="h-4 w-4" />} label="Missing in Books" value={String(summary.missingInBooks)} tone={summary.missingInBooks > 0 ? 'danger' : 'neutral'} />
        <SummaryCard icon={<FileX2 className="h-4 w-4" />} label="Missing in 2B" value={String(summary.missingIn2B)} tone={summary.missingIn2B > 0 ? 'danger' : 'neutral'} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MatchDistributionCard summary={summary} />
        <ITCRiskCard summary={summary} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice / GSTIN..."
              className="h-9 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-[#2A2E36] bg-[#0A0A0A] px-3 text-sm text-foreground"
          >
            <option value="all">All Status</option>
            <option value="perfect_match">Perfect Match</option>
            <option value="value_mismatch">Value Mismatch</option>
            <option value="tax_mismatch">Tax Mismatch</option>
            <option value="date_mismatch">Date Mismatch</option>
            <option value="gstin_mismatch">GSTIN Mismatch</option>
            <option value="missing_in_books">Missing in Books</option>
            <option value="missing_in_gstr2b">Missing in GSTR-2B</option>
            <option value="duplicate">Duplicate</option>
          </select>
          <select
            value={resolvedFilter}
            onChange={(e) => setResolvedFilter(e.target.value)}
            className="h-9 rounded-lg border border-[#2A2E36] bg-[#0A0A0A] px-3 text-sm text-foreground"
          >
            <option value="all">All</option>
            <option value="false">Unresolved</option>
            <option value="true">Resolved</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('csv')} className="gst-btn gst-btn-secondary gst-btn-sm">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <button onClick={() => handleExport('json')} className="gst-btn gst-btn-secondary gst-btn-sm">
            <Download className="h-3.5 w-3.5" /> JSON
          </button>
        </div>
      </div>

      <div className="gst-table-wrap">
        <table className="gst-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Invoice No</th>
              <th>Supplier GSTIN</th>
              <th className="text-right">Books Taxable</th>
              <th className="text-right">2B Taxable</th>
              <th className="text-right">ITC at Risk</th>
              <th>Oracle</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`s-${i}`}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><Skeleton className="h-5 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : matches.length === 0 ? (
              <tr>
                <td colSpan={8} className="!border-b-0 !p-0">
                  <div className="gst-empty-state">
                    <div className="gst-empty-state-icon">
                      <FileCheck2 className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <h3 className="gst-empty-state-title">No matches for this filter</h3>
                    <p className="gst-empty-state-desc">Try changing the status filter or clearing the search.</p>
                  </div>
                </td>
              </tr>
            ) : (
              matches.map((m) => {
                const meta = STATUS_META[m.status];
                const Icon = meta.icon;
                return (
                  <tr key={m.id} className={m.resolved ? 'opacity-60' : ''}>
                    <td>
                      <span className={`gst-status gst-status-${meta.color}`}>
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </span>
                    </td>
                    <td>
                      <div className="font-mono text-xs">{m.booksInvoiceNo || m.gstr2bInvoiceNo || '—'}</div>
                      {m.confidence > 0 && m.confidence < 1 && (
                        <div className="text-[10px] text-muted-foreground">{Math.round(m.confidence * 100)}% conf</div>
                      )}
                    </td>
                    <td className="font-mono text-xs">{m.booksSupplierGSTIN || m.gstr2bSupplierGSTIN || '—'}</td>
                    <td className="text-right tabular-nums">{fmtINR(m.booksTaxableValue)}</td>
                    <td className="text-right tabular-nums">{fmtINR(m.gstr2bTaxableValue)}</td>
                    <td className="text-right tabular-nums">
                      {m.itcAtRisk > 0 ? (
                        <span className="font-semibold text-[#F87171]">{fmtINR(m.itcAtRisk)}</span>
                      ) : '—'}
                    </td>
                    <td>
                      {m.aiExplanation ? (
                        <button
                          onClick={() => setSelectedMatch(m)}
                          className="gst-btn gst-btn-ghost gst-btn-sm"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-[#60A5FA]" />
                          View
                        </button>
                      ) : (
                        <button
                          onClick={() => handleExplain(runId, m, setMatches)}
                          className="gst-btn gst-btn-ghost gst-btn-sm"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Explain
                        </button>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => handleResolve(m.id, !m.resolved)}
                        className={`gst-btn gst-btn-sm ${m.resolved ? 'gst-btn-ghost' : 'gst-btn-outline'}`}
                      >
                        {m.resolved ? 'Reopen' : 'Resolve'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {selectedMatch && (
          <OracleDrawer
            match={selectedMatch}
            runId={runId}
            onClose={() => setSelectedMatch(null)}
            onResolved={(resolved) => {
              setMatches((prev) => prev.map((m) => m.id === selectedMatch.id ? { ...m, resolved } : m));
              setSelectedMatch((prev) => prev ? { ...prev, resolved } : null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

async function handleExplain(
  runId: string,
  match: MatchRow,
  setMatches: React.Dispatch<React.SetStateAction<MatchRow[]>>,
) {
  try {
    const res = await fetchWithTimeout(`/api/gst-reconciliation/${runId}/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: match.id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    setMatches((prev) => prev.map((m) => m.id === match.id ? {
      ...m,
      aiExplanation: data.explanation,
      aiRecommendation: data.recommendation,
    } : m));
  } catch {
    toast.error('Oracle could not analyze this mismatch');
  }
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  const toneColor: Record<string, string> = {
    success: 'text-[#60A5FA]',
    warning: 'text-[#FBBF24]',
    danger: 'text-[#F87171]',
    info: 'text-[#A78BFA]',
    neutral: 'text-foreground',
  };
  return (
    <div className="gst-card gst-card-compact gst-animate-in">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className={toneColor[tone]}>{icon}</span>
        <span className="gst-caption">{label}</span>
      </div>
      <div className={`gst-metric mt-2 ${toneColor[tone]}`}>{value}</div>
    </div>
  );
}

function MatchDistributionCard({ summary }: { summary: RunSummary }) {
  const data = [
    { label: 'Perfect Match', value: summary.matched, color: '#2563EB' },
    { label: 'Mismatches', value: summary.unmatched, color: '#F59E0B' },
    { label: 'Missing in Books', value: summary.missingInBooks, color: '#EF4444' },
    { label: 'Missing in 2B', value: summary.missingIn2B, color: '#8B5CF6' },
    { label: 'Duplicates', value: summary.duplicates, color: '#64748B' },
  ];
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="gst-card">
      <h3 className="gst-card-title mb-4">Match Distribution</h3>
      <div className="flex items-center gap-6">
        <svg width="160" height="160" viewBox="0 0 160 160" className="shrink-0">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#1F1F1F" strokeWidth="16" />
          {data.map((d, i) => {
            const len = (d.value / total) * circumference;
            const dasharray = `${len} ${circumference - len}`;
            const dashoffset = -offset;
            offset += len;
            return (
              <circle
                key={i}
                cx="80" cy="80" r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth="16"
                strokeDasharray={dasharray}
                strokeDashoffset={dashoffset}
                transform="rotate(-90 80 80)"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            );
          })}
          <text x="80" y="75" textAnchor="middle" className="fill-foreground" style={{ fontSize: 24, fontWeight: 700 }}>
            {summary.matchPercent}%
          </text>
          <text x="80" y="95" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>
            match rate
          </text>
        </svg>
        <div className="flex-1 space-y-2">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="flex-1 text-muted-foreground">{d.label}</span>
              <span className="font-medium tabular-nums">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ITCRiskCard({ summary }: { summary: RunSummary }) {
  const totalITC = summary.totalMatchedTax + summary.potentialITCLoss || 1;
  const safePct = (summary.totalMatchedTax / totalITC) * 100;
  const riskPct = (summary.potentialITCLoss / totalITC) * 100;

  return (
    <div className="gst-card">
      <h3 className="gst-card-title mb-4">ITC Position</h3>
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Safe ITC (matched)</span>
            <span className="font-semibold text-[#60A5FA]">{fmtINR(summary.totalMatchedTax)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#1F1F1F]">
            <div className="h-full bg-[#2563EB]" style={{ width: `${safePct}%`, transition: 'width 0.6s ease' }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">ITC at Risk</span>
            <span className="font-semibold text-[#F87171]">{fmtINR(summary.potentialITCLoss)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#1F1F1F]">
            <div className="h-full bg-[#EF4444]" style={{ width: `${riskPct}%`, transition: 'width 0.6s ease' }} />
          </div>
        </div>
        <div className="rounded-lg border border-[#1F1F1F] bg-[#0A0A0A] p-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-[#3B82F6]" />
            Total Taxable Value Reconciled
          </div>
          <div className="gst-metric mt-1">{fmtINR(summary.totalTaxableValue)}</div>
        </div>
      </div>
    </div>
  );
}

function OracleDrawer({
  match,
  runId,
  onClose,
  onResolved,
}: {
  match: MatchRow;
  runId: string;
  onClose: () => void;
  onResolved: (resolved: boolean) => void;
}) {
  const [explanation, setExplanation] = useState(match.aiExplanation);
  const [recommendation, setRecommendation] = useState(match.aiRecommendation);
  const [loading, setLoading] = useState(!match.aiExplanation);

  useEffect(() => {
    if (!match.aiExplanation) {
      void (async () => {
        try {
          const res = await fetchWithTimeout(`/api/gst-reconciliation/${runId}/explain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId: match.id }),
          });
          const data = await res.json();
          if (res.ok) {
            setExplanation(data.explanation);
            setRecommendation(data.recommendation);
          }
        } catch {
          // ignore
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [match.id, match.aiExplanation, runId]);

  const meta = STATUS_META[match.status];
  const Icon = meta.icon;

  const handleResolve = async (resolved: boolean) => {
    try {
      const res = await fetchWithTimeout(`/api/gst-reconciliation/${runId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id, resolved }),
      });
      if (!res.ok) throw new Error('Failed');
      onResolved(resolved);
      toast.success(resolved ? 'Marked as resolved' : 'Reopened');
    } catch {
      toast.error('Could not update status');
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-[#1F1F1F] bg-[#0A0A0A] p-6 custom-scrollbar"
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#60A5FA]" />
              <h2 className="gst-card-title">Oracle AI Analysis</h2>
            </div>
            <p className="gst-caption mt-1">Mismatch breakdown + recommended action</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-[#181818]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <span className={`gst-status gst-status-${meta.color}`}>
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
          </span>
          {match.confidence > 0 && (
            <span className="gst-caption">{Math.round(match.confidence * 100)}% confidence</span>
          )}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-[#1F1F1F] bg-[#0A0A0A] p-3">
            <div className="gst-caption mb-1">Books</div>
            <div className="font-mono text-xs">{match.booksInvoiceNo || '—'}</div>
            <div className="mt-1 text-xs text-muted-foreground">{fmtINR(match.booksTaxableValue)}</div>
          </div>
          <div className="rounded-lg border border-[#1F1F1F] bg-[#0A0A0A] p-3">
            <div className="gst-caption mb-1">GSTR-2B</div>
            <div className="font-mono text-xs">{match.gstr2bInvoiceNo || '—'}</div>
            <div className="mt-1 text-xs text-muted-foreground">{fmtINR(match.gstr2bTaxableValue)}</div>
          </div>
        </div>

        {match.mismatchReasons.length > 0 && (
          <div className="mb-4">
            <div className="gst-label mb-2">Mismatched Fields</div>
            <div className="space-y-1.5">
              {match.mismatchReasons.map((m, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border border-[#1F1F1F] bg-[#0A0A0A] px-3 py-2 text-xs">
                  <span className="font-medium uppercase tracking-wider text-muted-foreground">{m.field}</span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">{String(m.booksValue ?? '—')}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="tabular-nums text-[#60A5FA]">{String(m.gstr2bValue ?? '—')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4 rounded-xl border border-[#2563EB]/20 bg-[#2563EB]/[0.06] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#60A5FA]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#60A5FA]">Oracle Explanation</span>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing mismatch...
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-foreground">{explanation}</p>
          )}
        </div>

        {recommendation && !loading && (
          <div className="mb-6 rounded-xl border border-[#1F1F1F] bg-[#0A0A0A] p-4">
            <div className="mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#FBBF24]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#FBBF24]">Recommended Action</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{recommendation}</p>
          </div>
        )}

        {match.itcAtRisk > 0 && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-[#EF4444]/20 bg-[#EF4444]/[0.06] px-4 py-3">
            <span className="text-sm text-[#F87171]">ITC at Risk</span>
            <span className="gst-metric text-[#F87171]">{fmtINR(match.itcAtRisk)}</span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => handleResolve(!match.resolved)}
            className={`gst-btn gst-btn-lg flex-1 ${match.resolved ? 'gst-btn-secondary' : 'gst-btn-primary'}`}
          >
            {match.resolved ? 'Reopen' : 'Mark Resolved'}
          </button>
          <button onClick={onClose} className="gst-btn gst-btn-ghost gst-btn-lg">
            Close
          </button>
        </div>
      </motion.div>
    </>
  );
}

function RunDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

export default GSTReconciliationPage;
