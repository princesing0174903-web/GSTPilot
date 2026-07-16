'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books Integration Page (Phase 1: OAuth + Phase 2: Data Sync)
//
// Premium integration console mirroring the Google Workspace page design:
//   • Connection header (connect / disconnect / refresh / status)
//   • Connected-state card showing Organization + Scopes (Books, Invoices,
//     Customers, Bills, Expenses, Banking, Reports)
//   • Data Sync panel (Phase 2):
//       - Connected ✓ badge
//       - Last Sync (relative timestamp + duration)
//       - Records Imported (per-entity + total)
//       - Sync Status (Completed ✓ / Partial ⚠ / Failed ✗ / Running…)
//       - Current Organization
//       - Manual Sync button (with Full / Incremental toggle)
//   • OAuth success/error banner (reads ?zoho_connected=1 / ?zoho_error=…)
//   • Security note (AES-256-GCM encrypted tokens)
//
// Oracle Memory Engine + Oracle Chat read the existing GSTPilot tables that
// the sync writes into (Client, Vendor, Invoice, Expense, PurchaseBill,
// BankAccount, BankTransaction) — so synced Zoho data is immediately available
// to Oracle with zero Oracle code changes.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Plug,
  Unplug,
  AlertCircle,
  ShieldCheck,
  Building2,
  KeyRound,
  Database,
  Server,
  ArrowRight,
  Clock,
  ListChecks,
  Activity,
  PlayCircle,
  Users,
  Truck,
  FileText,
  Receipt,
  Banknote,
  Landmark,
  BookOpen,
  Percent,
  CreditCard,
  Package,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useZohoBooks, type ZohoSyncEntity } from '@/hooks/useZohoBooks';
import { useOrg } from '@/contexts/OrgContext';
import { ZohoCustomersSyncPanel } from './ZohoCustomersSyncPanel';
import { ZohoFullSyncPanel } from './ZohoFullSyncPanel';

// ─── Zoho Books brand mark (red "Z" tile) ────────────────────────────────────

function ZohoBooksLogo({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/[0.08] ${className ?? ''}`}
    >
      <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="#C8202F" />
        <path
          d="M9 22V20.4L17.2 11H9.4V9H20.4V10.6L12.2 20H20.4V22H9Z"
          fill="white"
        />
      </svg>
    </div>
  );
}

// ─── Connection Header ───────────────────────────────────────────────────────

function ConnectionHeader() {
  const { status, statusLoading, connect, disconnect, refresh, pending, refreshStatus } = useZohoBooks();
  const [connectError, setConnectError] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const handleConnect = useCallback(async () => {
    setConnectError(null);
    const { authUrl, error } = await connect();
    if (error) {
      setConnectError(error);
      return;
    }
    if (authUrl) {
      window.location.href = authUrl;
    }
  }, [connect]);

  const handleDisconnect = useCallback(() => {
    setConfirmDialogOpen(true);
  }, []);

  const confirmDisconnect = useCallback(async () => {
    setConfirmDialogOpen(false);
    const { error } = await disconnect();
    if (error) setConnectError(error);
  }, [disconnect]);

  const handleRefresh = useCallback(async () => {
    setConnectError(null);
    const { error } = await refresh();
    if (error) setConnectError(error);
  }, [refresh]);

  return (
    <>
    <Card className="border-border/60 bg-card/50 backdrop-blur">
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <ZohoBooksLogo className="h-12 w-12" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">Zoho Books</h2>
              {statusLoading ? (
                <Badge variant="outline" className="border-border/60 text-muted-foreground">
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Checking…
                </Badge>
              ) : status?.connected ? (
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Connected ✓
                </Badge>
              ) : (
                <Badge variant="outline" className="border-border/60 text-muted-foreground">
                  <XCircle className="mr-1 h-3 w-3" /> Not connected
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {status?.connected
                ? `Connected as ${status.userEmail ?? 'unknown'}`
                : 'Connect your Zoho Books account to enable India\u2019s leading accounting platform.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void refreshStatus()}
            disabled={statusLoading}
            className="h-8 gap-1.5 text-muted-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          {status?.connected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={pending}
                className="h-8 gap-1.5"
                title="Force-refresh the Zoho Books access token"
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                Refresh Token
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={pending}
                className="h-8 gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={pending}
              className="h-8 gap-1.5 bg-[#C8202F] text-white hover:bg-[#a01a26]"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
              Connect Zoho
            </Button>
          )}
        </div>
        {connectError ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {connectError}
          </div>
        ) : null}
      </CardContent>
    </Card>
    <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect Zoho Books?</AlertDialogTitle>
          <AlertDialogDescription>
            All synced customers, invoices, bills, and payments will remain in GSTPilot, but live sync will stop. You can reconnect anytime.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmDisconnect}
            className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
          >
            Disconnect
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

// ─── Sync panel (Phase 2) ────────────────────────────────────────────────────

const ENTITY_META: Array<{ key: ZohoSyncEntity; label: string; icon: React.ReactNode }> = [
  { key: 'customer', label: 'Customers', icon: <Users className="h-3.5 w-3.5" /> },
  { key: 'vendor', label: 'Vendors', icon: <Truck className="h-3.5 w-3.5" /> },
  { key: 'invoice', label: 'Invoices', icon: <FileText className="h-3.5 w-3.5" /> },
  { key: 'bill', label: 'Bills', icon: <Receipt className="h-3.5 w-3.5" /> },
  { key: 'payment', label: 'Payments', icon: <CreditCard className="h-3.5 w-3.5" /> },
  { key: 'creditnote', label: 'Credit Notes', icon: <FileText className="h-3.5 w-3.5" /> },
  { key: 'item', label: 'Items', icon: <Package className="h-3.5 w-3.5" /> },
  { key: 'expense', label: 'Expenses', icon: <Banknote className="h-3.5 w-3.5" /> },
  { key: 'bank_account', label: 'Bank Accounts', icon: <Landmark className="h-3.5 w-3.5" /> },
  { key: 'bank_transaction', label: 'Bank Transactions', icon: <Activity className="h-3.5 w-3.5" /> },
  { key: 'journal', label: 'Journals', icon: <BookOpen className="h-3.5 w-3.5" /> },
  { key: 'tax', label: 'Taxes', icon: <Percent className="h-3.5 w-3.5" /> },
];

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) {
    return (
      <Badge variant="outline" className="border-border/60 text-muted-foreground">
        Never synced
      </Badge>
    );
  }
  switch (status) {
    case 'running':
      return (
        <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-400">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Running…
        </Badge>
      );
    case 'completed':
      return (
        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
          <CheckCircle2 className="mr-1 h-3 w-3" /> Completed
        </Badge>
      );
    case 'partial':
      return (
        <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400">
          <AlertCircle className="mr-1 h-3 w-3" /> Partial
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-400">
          <XCircle className="mr-1 h-3 w-3" /> Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="border-border/60 text-muted-foreground">
          {status}
        </Badge>
      );
  }
}

function SyncPanel() {
  const {
    syncStatus,
    syncLoading,
    syncing,
    syncError,
    triggerSync,
    refreshSyncStatus,
  } = useZohoBooks();
  const [mode, setMode] = useState<'incremental' | 'full'>('incremental');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSync = useCallback(async () => {
    setLocalError(null);
    const { ok, error } = await triggerSync({ mode, resume: true });
    if (!ok && error) setLocalError(error);
  }, [triggerSync, mode]);

  const lastSync = syncStatus?.lastSync;
  const records = syncStatus?.recordsImported ?? {};
  const totalRecords = syncStatus?.totalRecords ?? 0;
  const currentEntity = lastSync?.currentEntity ?? null;
  const isRunning = syncing || lastSync?.status === 'running';

  // ── Live progress step label ──────────────────────────────────────────────
  //
  // Translates the raw `currentEntity` field from ZohoSyncLog into the
  // user-facing step text required by Phase 5:
  //   • Sync not started: "Ready to sync"
  //   • Sync running, no entity yet: "Connecting…"
  //   • Sync running, fetching entity X: "Fetching {EntityLabel}…"
  //   • Sync completed: "Completed"
  //   • Sync failed: "Failed"
  const progressStep: string = (() => {
    if (!isRunning) {
      if (lastSync?.status === 'completed') return 'Completed';
      if (lastSync?.status === 'failed') return 'Failed';
      if (lastSync?.status === 'partial') return 'Partially completed';
      return 'Ready to sync';
    }
    if (!currentEntity) return 'Connecting…';
    const label = ENTITY_META.find((e) => e.key === currentEntity)?.label ?? currentEntity;
    return `Fetching ${label}…`;
  })();

  // Progress percentage — based on how many entities have completed (have
  // non-zero stats in lastSync.stats) vs total entities.
  const progressPercent: number = (() => {
    if (!isRunning) return lastSync?.status === 'completed' ? 100 : 0;
    if (!lastSync?.stats) return 0;
    const completed = Object.values(lastSync.stats).filter(
      (s) => s && (s.imported > 0 || s.updated > 0 || s.failed > 0 || s.pages > 0),
    ).length;
    // Total entities = 12 (ZOHO_SYNC_ENTITIES). currentEntity adds partial credit.
    const total = ENTITY_META.length;
    const currentIdx = currentEntity ? ENTITY_META.findIndex((e) => e.key === currentEntity) : -1;
    const base = currentIdx >= 0 ? (currentIdx / total) * 100 : 0;
    return Math.min(99, Math.round(base + (completed / total) * 100));
  })();

  return (
    <Card className="border-border/60 bg-card/50 backdrop-blur">
      <CardContent className="p-6">
        <div className="flex flex-col gap-5">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-[#C8202F]" />
              <span className="text-sm font-semibold tracking-tight">Data Sync</span>
              <StatusBadge status={lastSync?.status} />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void refreshSyncStatus()}
                disabled={syncLoading}
                className="h-7 gap-1.5 text-xs text-muted-foreground"
              >
                <RefreshCw className={`h-3 w-3 ${syncLoading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
              <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-muted/20 p-0.5">
                <button
                  type="button"
                  onClick={() => setMode('incremental')}
                  className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${
                    mode === 'incremental' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  Incremental
                </button>
                <button
                  type="button"
                  onClick={() => setMode('full')}
                  className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${
                    mode === 'full' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  Full
                </button>
              </div>
              <Button
                size="sm"
                onClick={handleSync}
                disabled={syncing}
                className="h-8 gap-1.5 bg-[#C8202F] text-white hover:bg-[#a01a26]"
              >
                {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                {syncing ? 'Syncing…' : 'Sync Now'}
              </Button>
            </div>
          </div>

          {/* Phase 5 — Live progress bar + step indicator */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {isRunning ? (
                  <Loader2 className="h-3 w-3 animate-spin text-[#C8202F]" />
                ) : lastSync?.status === 'completed' ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                ) : lastSync?.status === 'failed' ? (
                  <XCircle className="h-3 w-3 text-red-400" />
                ) : (
                  <Database className="h-3 w-3 text-muted-foreground/60" />
                )}
                <span className={
                  isRunning ? 'text-foreground font-medium' :
                  lastSync?.status === 'completed' ? 'text-emerald-400 font-medium' :
                  lastSync?.status === 'failed' ? 'text-red-400 font-medium' :
                  'text-muted-foreground'
                }>
                  {progressStep}
                </span>
              </div>
              {isRunning && (
                <span className="font-mono text-[10px] text-muted-foreground">{progressPercent}%</span>
              )}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  lastSync?.status === 'failed'
                    ? 'bg-red-500'
                    : lastSync?.status === 'completed'
                    ? 'bg-emerald-500'
                    : 'bg-gradient-to-r from-[#C8202F] to-[#E8505A]'
                }`}
                style={{ width: `${isRunning ? progressPercent : lastSync?.status === 'completed' ? 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Last sync + records grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SyncMetric
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Last Sync"
              value={lastSync ? timeAgo(lastSync.startedAt) : '—'}
              sub={lastSync?.durationMs !== null && lastSync?.durationMs !== undefined ? formatDuration(lastSync.durationMs) : undefined}
            />
            <SyncMetric
              icon={<ListChecks className="h-3.5 w-3.5" />}
              label="Records Imported"
              value={totalRecords.toLocaleString('en-IN')}
              sub={lastSync ? `${lastSync.mode} sync` : undefined}
            />
            <SyncMetric
              icon={<Building2 className="h-3.5 w-3.5" />}
              label="Organization"
              value={syncStatus?.organizationName ?? 'Not mapped'}
              sub={syncStatus?.zohoOrgId ? `ID: ${syncStatus.zohoOrgId}` : undefined}
            />
            <SyncMetric
              icon={<Activity className="h-3.5 w-3.5" />}
              label="Status"
              value={lastSync ? lastSync.status : '—'}
              sub={lastSync?.error ? `error: ${lastSync.error.slice(0, 30)}…` : undefined}
              valueClassName={
                lastSync?.status === 'completed'
                  ? 'text-emerald-400'
                  : lastSync?.status === 'failed'
                  ? 'text-red-400'
                  : lastSync?.status === 'partial'
                  ? 'text-amber-400'
                  : 'text-muted-foreground'
              }
            />
          </div>

          {/* Per-entity breakdown */}
          <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <ListChecks className="h-3 w-3" />
              Per-entity Breakdown
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ENTITY_META.map((e) => {
                const count = records[e.key] ?? 0;
                const stats = lastSync?.stats?.[e.key];
                const hasError = stats?.failed && stats.failed > 0;
                return (
                  <div
                    key={e.key}
                    className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="text-muted-foreground/80">{e.icon}</span>
                      {e.label}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono font-medium text-foreground">{count}</span>
                      {hasError ? (
                        <span
                          title={`${stats?.failed} failed${stats?.lastError ? `: ${stats.lastError}` : ''}`}
                          className="h-1.5 w-1.5 rounded-full bg-amber-500"
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error banner */}
          {(localError || syncError || lastSync?.error) && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="leading-relaxed">
                {localError || syncError || lastSync?.error}
              </span>
            </div>
          )}

          {/* Oracle integration note */}
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="leading-relaxed">
              Synced data flows into Oracle automatically. Ask Oracle{' '}
              <span className="font-medium">&quot;Who owes me money?&quot;</span>,{' '}
              <span className="font-medium">&quot;Which invoices are overdue?&quot;</span>,{' '}
              <span className="font-medium">&quot;What is my cash balance?&quot;</span> — answers come from your live Zoho Books data.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SyncMetric({
  icon,
  label,
  value,
  sub,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <span className={`text-sm font-semibold ${valueClassName ?? 'text-foreground'}`}>{value}</span>
      {sub ? <span className="text-[10px] text-muted-foreground/70">{sub}</span> : null}
    </div>
  );
}

// ─── Connected-state details card ────────────────────────────────────────────

function ConnectionDetails() {
  const { status, testConnection, pending } = useZohoBooks();
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    httpStatus: number;
    organization: import('@/hooks/useZohoBooks').ZohoTestConnectionOrganization | null;
    error: string | null;
    testedAt: string | null;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testConnection();
    setTestResult(result);
    setTesting(false);
  }, [testConnection]);

  if (!status?.connected) {
    return null;
  }

  return (
    <Card className="border-border/60 bg-card/50 backdrop-blur">
      <CardContent className="p-6">
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold tracking-tight">Connection Details</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testing || pending}
              className="h-8 gap-1.5"
              title="Probes the Zoho Books API with a real authenticated request to verify the connection"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
              {testing ? 'Testing…' : 'Test Connection'}
            </Button>
          </div>

          {/* Test Connection result */}
          <AnimatePresence>
            {testResult ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`flex flex-col gap-2 rounded-lg border px-3 py-3 text-xs ${
                  testResult.ok
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                    : 'border-red-500/30 bg-red-500/5 text-red-400'
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  {testResult.ok ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>
                    {testResult.ok
                      ? 'Connection Successful'
                      : `Connection Failed (HTTP ${testResult.httpStatus || '—'})`}
                  </span>
                  {testResult.testedAt ? (
                    <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                      {new Date(testResult.testedAt).toLocaleString()}
                    </span>
                  ) : null}
                </div>
                {testResult.ok && testResult.organization ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-6 text-[11px] sm:grid-cols-3">
                    <DetailRow label="Organization" value={testResult.organization.name} />
                    <DetailRow label="Org ID" value={testResult.organization.organization_id} mono />
                    <DetailRow
                      label="Active"
                      value={
                        testResult.organization.is_org_active === null
                          ? '—'
                          : testResult.organization.is_org_active
                          ? 'Yes'
                          : 'No'
                      }
                    />
                    <DetailRow label="Plan" value={testResult.organization.plan_name ?? '—'} />
                    <DetailRow label="Country" value={testResult.organization.country_name ?? '—'} />
                    <DetailRow label="Currency" value={testResult.organization.currency_code ?? '—'} />
                    {testResult.organization.gst_no ? (
                      <DetailRow label="GSTIN" value={testResult.organization.gst_no} mono />
                    ) : null}
                    {testResult.organization.email ? (
                      <DetailRow label="Contact" value={testResult.organization.email} />
                    ) : null}
                  </div>
                ) : null}
                {testResult.error ? (
                  <div className="pl-6 text-[11px] leading-relaxed text-red-400/90">
                    {testResult.error}
                  </div>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Organization */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <Building2 className="h-3 w-3" />
              Organization Name
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {status.organizationName ?? 'Not mapped yet'}
              </span>
              {status.zohoOrgId ? (
                <Badge variant="outline" className="h-5 px-1.5 text-[9px] font-mono text-muted-foreground">
                  ID: {status.zohoOrgId}
                </Badge>
              ) : null}
            </div>
            {status.dataCenter ? (
              <span className="text-[10px] text-muted-foreground/70">
                Data center: <span className="font-mono">{status.dataCenter}</span>
              </span>
            ) : null}
          </div>

          {/* Scopes */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              Scopes
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {status.scopeAreas.length > 0 ? (
                status.scopeAreas.map((s) => (
                  <Badge
                    key={s}
                    variant="outline"
                    className="h-6 px-2 text-[10px] font-medium border-[#C8202F]/20 bg-[#C8202F]/5 text-[#ff6b78]"
                  >
                    {s}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">No scopes</span>
              )}
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/40">
            <MetaItem
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Last Connected"
              value={status.lastConnectedAt ? new Date(status.lastConnectedAt).toLocaleString() : '—'}
              valueClassName="text-muted-foreground"
            />
            <MetaItem
              icon={<KeyRound className="h-3.5 w-3.5" />}
              label="Access Token"
              value="AES-256-GCM encrypted"
              valueClassName="text-emerald-400"
            />
            <MetaItem
              icon={<Database className="h-3.5 w-3.5" />}
              label="Token Storage"
              value="ZohoBooksToken (Prisma)"
              valueClassName="text-muted-foreground font-mono"
            />
            <MetaItem
              icon={<Server className="h-3.5 w-3.5" />}
              label="Connected At"
              value={status.connectedAt ? new Date(status.connectedAt).toLocaleString() : '—'}
              valueClassName="text-muted-foreground"
            />
            <MetaItem
              icon={<Building2 className="h-3.5 w-3.5" />}
              label="User Email"
              value={status.userEmail ?? '—'}
              valueClassName="text-muted-foreground"
            />
            <MetaItem
              icon={<Server className="h-3.5 w-3.5" />}
              label="Zoho User ID"
              value={status.zohoUserId ?? '—'}
              valueClassName="text-muted-foreground font-mono"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70">
        {label}
      </span>
      <span className={`text-[11px] text-foreground ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function MetaItem({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <span className={`text-xs ${valueClassName ?? 'text-foreground'}`}>{value}</span>
    </div>
  );
}

// ─── Not-connected gate ──────────────────────────────────────────────────────

function NotConnectedGate({ children }: { children: React.ReactNode }) {
  const { status, statusLoading } = useZohoBooks();
  if (statusLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }
  if (!status?.connected) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center gap-5 rounded-2xl border border-border/60 bg-card/50 p-8 text-center shadow-sm backdrop-blur">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
            <Plug className="h-7 w-7 text-amber-500" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold tracking-tight">Connect Zoho Books</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Click <span className="font-medium text-foreground">Connect Zoho</span> above to authorize GSTPilot
              to access your Zoho Books organization. Tokens are encrypted with AES-256-GCM at rest.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <ArrowRight className="h-3 w-3" />
            <span>India&apos;s leading accounting platform · OAuth 2.0 · Multi-tenant</span>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ZohoBooksPage() {
  const { organization } = useOrg();

  // Detect ?zoho_connected=1 or ?zoho_error=… from the OAuth callback
  // redirect and surface a one-shot toast-like banner.
  const [oauthBanner, setOauthBanner] = useState<{ ok: boolean; message: string } | null>(null);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('zoho_connected')) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOauthBanner({ ok: true, message: 'Zoho Books connected successfully.' });
      } else if (params.get('zoho_error')) {
        setOauthBanner({
          ok: false,
          message: `Zoho connection failed: ${params.get('zoho_error')}`,
        });
      }
      // Clean the URL.
      if (params.get('zoho_connected') || params.get('zoho_error')) {
        const clean = window.location.pathname;
        window.history.replaceState({}, '', clean);
      }
    } catch {
      /* SSR guard */
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Zoho Books</h1>
          <Badge variant="outline" className="border-[#C8202F]/30 bg-[#C8202F]/10 text-[#ff6b78]">
            Accounting Integration
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {organization?.name ? `${organization.name} · ` : ''}
          India&apos;s leading accounting platform — OAuth 2.0 + automated data sync into Oracle.
        </p>
      </div>

      {/* OAuth banner */}
      <AnimatePresence>
        {oauthBanner ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
              oauthBanner.ok
                ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                : 'border-red-500/20 bg-red-500/5 text-red-400'
            }`}
          >
            {oauthBanner.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            <span className="flex-1">{oauthBanner.message}</span>
            <button
              onClick={() => setOauthBanner(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Connection */}
      <ConnectionHeader />

      {/* Security note */}
      <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        <span>
          Tokens are AES-256-GCM encrypted at rest. Only your organization can access them. Disconnect anytime to
          revoke access.
        </span>
      </div>

      {/* Full Sync panel — always visible. The sync engine returns a clear
          "not connected" error if the user hasn't completed OAuth yet. */}
      <ZohoFullSyncPanel />

      {/* Connection details + customer sync panel (only when connected) */}
      <NotConnectedGate>
        <div className="flex flex-col gap-4">
          <SyncPanel />
          <ZohoCustomersSyncPanel />
          <ConnectionDetails />
        </div>
      </NotConnectedGate>
    </div>
  );
}
