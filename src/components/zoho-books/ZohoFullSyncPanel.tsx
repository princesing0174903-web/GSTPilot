'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Zoho Books Full Sync Panel (Phase 5)
// ═══════════════════════════════════════════════════════════════════════════════
//
// The "Sync Now" button behind the full Zoho Books data synchronization engine.
// Synchronizes ALL 13 modules: Customers, Vendors, Items, Invoices, Bills,
// Payments Received, Payments Made, Credit Notes, Expenses, Taxes, Journals,
// Bank Accounts, Bank Transactions.
//
// Features:
//   • Full Sync / Incremental Sync toggle
//   • Live progress: "Connecting…" → "Fetching Customers…" → "Fetching Invoices…"
//     → "Saving…" → "Completed" (polls GET /sync/status every 1.5s)
//   • Live dashboard: Records Imported, Last Sync, Per-Entity Counts, Status
//   • Detailed error display: 401 (reconnect), 403 (scope), 404, 429 (rate limit), 500
//   • Per-module breakdown with fetched/imported/updated/failed counts
//
// NEVER uses mock data. Every record comes from the real Zoho Books REST API.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw, CheckCircle2, XCircle, AlertTriangle, Loader2,
  Database, Clock, Activity, Zap, ArrowDownUp, Users, Truck,
  FileText, Receipt, Banknote, Landmark, BookOpen, Percent,
  CreditCard, Package, TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useOrg } from '@/contexts/OrgContext';
import { useBusinessSnapshot } from '@/hooks/useBusinessSnapshot';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SyncModuleResult {
  module: string;
  status: 'ok' | 'error' | 'skipped';
  fetched: number;
  imported: number;
  updated: number;
  failed: number;
  error?: string;
  httpStatus?: number;
}

interface SyncResult {
  ok: boolean;
  status: 'running' | 'completed' | 'partial' | 'failed';
  mode: 'full' | 'incremental';
  syncLogId: string;
  zohoOrgId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  totalFetched: number;
  totalImported: number;
  totalUpdated: number;
  totalFailed: number;
  modules: SyncModuleResult[];
  error: string | null;
}

interface SyncStatus {
  status: 'running' | 'completed' | 'partial' | 'failed' | 'idle';
  currentEntity: string | null;
  mode: 'full' | 'incremental' | null;
  startedAt: string | null;
  completedAt: string | null;
  stats: Record<string, unknown>;
  lastSync: {
    status: string;
    startedAt: string;
    completedAt: string | null;
    durationMs: number;
    totals: { fetched: number; imported: number; updated: number; failed: number };
  } | null;
}

// ─── Module metadata (label + icon for the progress display) ─────────────────

const MODULE_META: Record<string, { label: string; icon: typeof Users }> = {
  customers: { label: 'Customers', icon: Users },
  vendors: { label: 'Vendors', icon: Truck },
  items: { label: 'Items', icon: Package },
  invoices: { label: 'Invoices', icon: FileText },
  bills: { label: 'Bills', icon: Receipt },
  payments_received: { label: 'Payments Received', icon: Banknote },
  payments_made: { label: 'Payments Made', icon: CreditCard },
  creditnotes: { label: 'Credit Notes', icon: FileText },
  expenses: { label: 'Expenses', icon: Receipt },
  taxes: { label: 'Taxes', icon: Percent },
  journals: { label: 'Journals', icon: BookOpen },
  bankaccounts: { label: 'Bank Accounts', icon: Landmark },
  banktransactions: { label: 'Bank Transactions', icon: ArrowDownUp },
};

const MODULE_ORDER = [
  'customers', 'vendors', 'items', 'invoices', 'bills',
  'payments_received', 'payments_made', 'creditnotes', 'expenses',
  'taxes', 'journals', 'bankaccounts', 'banktransactions',
];

// ─── Progress label helper ────────────────────────────────────────────────────

function progressLabel(entity: string | null, status: string): string {
  if (status === 'completed') return '✓ Sync Completed';
  if (status === 'failed') return '✗ Sync Failed';
  if (status === 'partial') return '⚠ Sync Partial';
  if (!entity || entity === 'connecting') return 'Connecting to Zoho Books…';
  if (entity === 'completed') return 'Saving records…';
  const meta = MODULE_META[entity];
  return meta ? `Fetching ${meta.label}…` : `Fetching ${entity}…`;
}

// ─── Error badge helper ───────────────────────────────────────────────────────

function errorBadge(httpStatus?: number): { label: string; variant: 'destructive' | 'default' } {
  if (!httpStatus) return { label: '', variant: 'default' };
  switch (httpStatus) {
    case 401: return { label: '401 — Token expired, reconnect', variant: 'destructive' };
    case 403: return { label: '403 — Permission denied', variant: 'destructive' };
    case 404: return { label: '404 — Not found', variant: 'destructive' };
    case 429: return { label: '429 — Rate limited', variant: 'destructive' };
    case 500: case 502: case 503: return { label: `${httpStatus} — Server error`, variant: 'destructive' };
    default: return { label: `HTTP ${httpStatus}`, variant: 'destructive' };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ZohoFullSyncPanel() {
  const { organization } = useOrg();
  const orgId = organization?.id ?? 'preview-org';
  const { snapshot, refresh: refreshSnapshot } = useBusinessSnapshot();

  const [mode, setMode] = useState<'full' | 'incremental'>('full');
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [liveStatus, setLiveStatus] = useState<SyncStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll sync status while syncing
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/zoho/sync', {
        headers: { 'x-gstpilot-orgid': orgId },
      });
      if (res.ok) {
        const data: SyncStatus = await res.json();
        setLiveStatus(data);
        if (data.status !== 'running') {
          // Sync finished — stop polling
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setSyncing(false);
          // Refresh the business snapshot so the dashboard shows fresh data
          refreshSnapshot();
        }
      }
    } catch {
      /* polling is best-effort */
    }
  }, [orgId, refreshSnapshot]);

  // Trigger a sync
  const handleSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    setResult(null);

    try {
      // Start polling for live progress
      pollRef.current = setInterval(pollStatus, 1500);

      const res = await fetch('/api/integrations/zoho/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gstpilot-orgid': orgId,
        },
        body: JSON.stringify({ mode }),
      });

      const data: SyncResult = await res.json();
      setResult(data);

      if (!data.ok) {
        setError(data.error || 'Sync failed. Check the module errors below.');
      }

      // Final status poll
      await pollStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error during sync.');
      setSyncing(false);
    } finally {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [orgId, mode, pollStatus]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Fetch initial status on mount
  useEffect(() => {
    pollStatus();
  }, [pollStatus]);

  const currentEntity = liveStatus?.currentEntity ?? null;
  const currentStatus = syncing ? 'running' : (liveStatus?.status ?? 'idle');
  const lastSync = liveStatus?.lastSync;

  // Progress percentage based on which module is being synced
  const progressPercent = (() => {
    if (currentStatus === 'completed') return 100;
    if (currentStatus === 'failed' || currentStatus === 'partial') return 100;
    if (!currentEntity || currentEntity === 'connecting') return 5;
    if (currentEntity === 'completed') return 95;
    const idx = MODULE_ORDER.indexOf(currentEntity);
    if (idx === -1) return 50;
    return Math.round(((idx + 1) / MODULE_ORDER.length) * 100);
  })();

  return (
    <Card className="border-white/[0.08] bg-white/[0.02]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/[0.08]">
            <Database className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-white">
              Full Data Synchronization
            </CardTitle>
            <p className="text-xs text-white/50">
              Sync all 13 Zoho Books modules into VEYRO
            </p>
          </div>
        </div>
        <Badge
          variant={currentStatus === 'running' ? 'default' : currentStatus === 'completed' ? 'default' : 'secondary'}
          className={
            currentStatus === 'running' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            : currentStatus === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            : currentStatus === 'failed' ? 'bg-red-500/20 text-red-300 border-red-500/30'
            : currentStatus === 'partial' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            : 'bg-white/[0.06] text-white/60'
          }
        >
          {currentStatus === 'running' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          {currentStatus === 'completed' && <CheckCircle2 className="mr-1 h-3 w-3" />}
          {currentStatus === 'failed' && <XCircle className="mr-1 h-3 w-3" />}
          {currentStatus === 'partial' && <AlertTriangle className="mr-1 h-3 w-3" />}
          {currentStatus === 'idle' ? 'Ready' : currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Sync controls ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={mode === 'full' ? 'default' : 'outline'}
              onClick={() => setMode('full')}
              disabled={syncing}
              className={mode === 'full' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Full Sync
            </Button>
            <Button
              size="sm"
              variant={mode === 'incremental' ? 'default' : 'outline'}
              onClick={() => setMode('incremental')}
              disabled={syncing}
              className={mode === 'incremental' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              <Zap className="mr-1.5 h-3.5 w-3.5" />
              Incremental
            </Button>
          </div>
          <Button
            onClick={handleSync}
            disabled={syncing}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Now
              </>
            )}
          </Button>
        </div>

        {/* ── Live progress bar ── */}
        {(syncing || currentStatus === 'running' || progressPercent > 0) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-white/80">
                {progressLabel(currentEntity, currentStatus)}
              </span>
              <span className="text-white/50">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2 bg-white/[0.06]" />
          </div>
        )}

        {/* ── Error banner ── */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-medium">Sync Error</p>
              <p className="text-xs text-red-300/80">{error}</p>
            </div>
          </div>
        )}

        {/* ── Live dashboard: Records Imported, Last Sync, Per-Entity ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            icon={<Database className="h-4 w-4" />}
            label="Records Imported"
            value={result?.totalImported ?? lastSync?.totals.imported ?? snapshot?.perEntity?.zohoCustomers ?? 0}
            subtext={result ? `${result.totalFetched} fetched` : undefined}
          />
          <MetricCard
            icon={<Clock className="h-4 w-4" />}
            label="Last Sync"
            value={
              lastSync?.completedAt
                ? new Date(lastSync.completedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                : snapshot?.lastSyncAt
                ? new Date(snapshot.lastSyncAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                : 'Never'
            }
            subtext={lastSync ? `${Math.round(lastSync.durationMs / 1000)}s` : undefined}
          />
          <MetricCard
            icon={<Activity className="h-4 w-4" />}
            label="Status"
            value={snapshot?.lastSyncStatus ?? 'never'}
            subtext={result?.mode ?? lastSync?.status}
          />
          <MetricCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Health Score"
            value={snapshot?.healthScore ?? 0}
            subtext={`/ 100`}
          />
        </div>

        {/* ── Per-entity counts (from the business snapshot) ── */}
        {snapshot && (
          <div>
            <p className="mb-2 text-xs font-medium text-white/60">Per-Entity Counts (synced in DB)</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {MODULE_ORDER.map((key) => {
                const meta = MODULE_META[key];
                const perEntity = (snapshot.perEntity ?? {}) as Record<string, number | undefined>;
                const count = perEntity[
                  key === 'customers' ? 'zohoCustomers'
                  : key === 'vendors' ? 'zohoVendors'
                  : key === 'items' ? 'zohoItems'
                  : key === 'invoices' ? 'zohoInvoices'
                  : key === 'bills' ? 'zohoBills'
                  : key === 'payments_received' ? 'zohoPaymentsReceived'
                  : key === 'payments_made' ? 'zohoPaymentsMade'
                  : key === 'creditnotes' ? 'zohoCreditNotes'
                  : key === 'expenses' ? 'zohoExpenses'
                  : key === 'taxes' ? 'zohoTaxes'
                  : key === 'journals' ? 'zohoJournals'
                  : key === 'bankaccounts' ? 'zohoBankAccounts'
                  : key === 'banktransactions' ? 'zohoBankTransactions'
                  : key
                ] ?? 0;
                const Icon = meta.icon;
                return (
                  <div
                    key={key}
                    className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                  >
                    <Icon className="h-3.5 w-3.5 text-white/40" />
                    <span className="flex-1 truncate text-xs text-white/60">{meta.label}</span>
                    <span className={`text-sm font-semibold ${count > 0 ? 'text-emerald-400' : 'text-white/30'}`}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Per-module sync result breakdown ── */}
        {result && result.modules.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-white/60">
              Module Breakdown — {result.modules.filter((m) => m.status === 'ok').length} OK,{' '}
              {result.modules.filter((m) => m.status === 'error').length} errors
            </p>
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {result.modules.map((m) => {
                const meta = MODULE_META[m.module];
                const Icon = meta?.icon ?? Database;
                const eb = errorBadge(m.httpStatus);
                return (
                  <div
                    key={m.module}
                    className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs"
                  >
                    <Icon className="h-3.5 w-3.5 text-white/40" />
                    <span className="w-32 flex-shrink-0 truncate font-medium text-white/70">
                      {meta?.label ?? m.module}
                    </span>
                    {m.status === 'ok' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                    {m.status === 'error' && <XCircle className="h-3.5 w-3.5 text-red-400" />}
                    {m.status === 'skipped' && <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                    <span className="flex-1 text-white/50">
                      fetched: {m.fetched} | imported: {m.imported} | updated: {m.updated}
                      {m.failed > 0 && <span className="text-red-400"> | failed: {m.failed}</span>}
                    </span>
                    {m.error && (
                      <Badge variant={eb.variant} className="text-[10px]">
                        {eb.label || m.error.slice(0, 40)}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Summary footer ── */}
        {result && (
          <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-xs">
            <span className="text-white/50">
              Duration: {(result.durationMs / 1000).toFixed(1)}s · Mode: {result.mode}
            </span>
            <span className="text-white/50">
              Total: {result.totalFetched} fetched · {result.totalImported} imported · {result.totalUpdated} updated
              {result.totalFailed > 0 && <span className="text-red-400"> · {result.totalFailed} failed</span>}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Metric card sub-component ───────────────────────────────────────────────

function MetricCard({
  icon, label, value, subtext,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center gap-1.5 text-white/40">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
      {subtext && <div className="text-[10px] text-white/40">{subtext}</div>}
    </div>
  );
}
