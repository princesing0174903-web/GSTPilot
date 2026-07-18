'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Data Connections™ (Real-Time Sync Center)
// PHASE 2A · MODULE 6 + PHASE 2B · MODULE 1 (Auto Sync Engine)
//
// The command center for live GSTN + Banking data. Shows every connected
// service, its sync status, records imported, errors, and last sync time.
// Actions: Connect · Sync Now · Retry Failed · View Logs · Disconnect.
//
// Data sources:
//   GET  /api/connections            → list with syncStatus + recentLogs
//   POST /api/connections/[id]/sync  → trigger a sync
//   GET  /api/connections/[id]/logs  → full import history
//   DELETE /api/connections/[id]     → disconnect
//   GET  /api/data-normalization     → unified entity counts (MODULE 3)
//
// Cross-component: dispatches `connections-updated` after sync/disconnect so
// Mission Control + Oracle refresh. Listens for the same event to refresh itself.
// Auto-polls every 15s so a syncing connection flips to "connected" live.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Landmark, RefreshCw, Unplug, FileText, ScrollText,
  CheckCircle2, AlertTriangle, AlertCircle, Loader2, Clock,
  Database, Activity, Zap, Plus, Layers, Users, Truck, BellRing,
  Wallet, Receipt, type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { cn } from '@/lib/utils';

// ─── Types (mirror /api/connections response) ─────────────────────────────────

type SyncStatus = 'connected' | 'syncing' | 'partial' | 'failed' | 'disconnected';

interface SyncLogRow {
  id: string;
  status: string;
  recordsImported: number;
  errorsCount: number;
  message: string | null;
  errorDetail: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface ConnectionRow {
  id: string;
  type: 'gstn' | 'bank';
  provider: string;
  status: string;
  legalName?: string | null;
  tradeName?: string | null;
  gstin?: string | null;
  maskedRef?: string | null;
  lastSyncedAt?: string | null;
  createdAt: string;
  syncStatus: SyncStatus;
  lastSyncRecords: number;
  lastSyncErrors: number;
  lastSyncMessage?: string | null;
  recentLogs?: SyncLogRow[];
  // PHASE 2B — Auto Sync Engine fields
  autoSync?: boolean;
  syncIntervalMins?: number;
  nextSyncAt?: string | null;
  lastSyncDurationMs?: number;
  consecutiveFailures?: number;
  lastValidationScore?: number;
  summary:
    | {
        kind: 'gstn';
        legalName: string;
        tradeName: string;
        gstin: string;
        complianceScore: number;
        pendingReturns: number;
        overdueReturns: number;
        activeNotices: number;
      }
    | {
        kind: 'bank';
        provider: string;
        maskedAccount: string;
        closingBalance: number;
        monthlyCollections: number;
      };
}

interface EntityCounts {
  Firm?: number; Client?: number; Vendor?: number; Invoice?: number;
  Return?: number; Notice?: number; Payment?: number; BankTransaction?: number;
  Expense?: number; Document?: number;
}

// PHASE 2B — Auto Sync Engine types
interface QueueItemRow {
  id: string;
  connectionLabel: string;
  connectionType: string;
  status: string;
  trigger: string;
  attempts: number;
  maxAttempts: number;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  lastError?: string;
}

interface AutoSyncStatusRow {
  totalConnections: number;
  autoSyncEnabled: number;
  dueNow: number;
  queueDepth: number;
  running: number;
  nextRunAt?: string;
  lastRunAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inrShort(n: number): string {
  if (!isFinite(n) || n === 0) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 1e7) return '₹' + (n / 1e7).toFixed(2) + 'Cr';
  if (abs >= 1e5) return '₹' + (n / 1e5).toFixed(2) + 'L';
  if (abs >= 1e3) return '₹' + (n / 1e3).toFixed(1) + 'k';
  return '₹' + Math.round(n);
}

function timeAgo(iso?: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Never';
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 0) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const SYNC_STATUS_META: Record<SyncStatus, { label: string; color: string; dot: string; icon: LucideIcon }> = {
  connected:   { label: 'Connected',    color: 'text-emerald-400',  dot: 'bg-emerald-400',  icon: CheckCircle2 },
  syncing:     { label: 'Syncing',      color: 'text-cyan-400',     dot: 'bg-cyan-400',     icon: Loader2 },
  partial:     { label: 'Partial',      color: 'text-amber-400',    dot: 'bg-amber-400',    icon: AlertTriangle },
  failed:      { label: 'Failed',       color: 'text-rose-400',     dot: 'bg-rose-400',     icon: AlertCircle },
  disconnected:{ label: 'Disconnected', color: 'text-muted-foreground', dot: 'bg-muted-foreground', icon: Unplug },
};

const BANK_META: Record<string, { label: string; color: string }> = {
  HDFC:  { label: 'HDFC Bank',   color: '#004C8F' },
  ICICI: { label: 'ICICI Bank',  color: '#F37E20' },
  SBI:   { label: 'State Bank of India', color: '#1E4D8C' },
  AXIS:  { label: 'Axis Bank',   color: '#97144D' },
  KOTAK: { label: 'Kotak Bank',  color: '#ED1C24' },
  YES:   { label: 'Yes Bank',    color: '#00A9E0' },
};

const ALL_BANKS = ['HDFC', 'ICICI', 'SBI', 'AXIS', 'KOTAK', 'YES'];

const ENTITY_DEFS: [keyof EntityCounts, LucideIcon][] = [
  ['Firm', Building2], ['Client', Users], ['Vendor', Truck], ['Invoice', FileText],
  ['Return', ScrollText], ['Notice', BellRing], ['Payment', Wallet], ['BankTransaction', Landmark],
  ['Expense', Receipt], ['Document', FileText],
];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function DataConnectionsPage() {
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsFor, setLogsFor] = useState<ConnectionRow | null>(null);
  const [logs, setLogs] = useState<SyncLogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [entityCounts, setEntityCounts] = useState<EntityCounts>({});
  // PHASE 2B — Auto Sync Engine state
  const [queueItems, setQueueItems] = useState<QueueItemRow[]>([]);
  const [autoSyncStatus, setAutoSyncStatus] = useState<AutoSyncStatusRow | null>(null);
  const [runningSync, setRunningSync] = useState(false);
  // ── Disconnect confirmation dialog state ──
  const [pendingDisconnect, setPendingDisconnect] = useState<{ id: string; name: string } | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // ── Fetch connections ──
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/connections', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections ?? []);
      }
    } catch {
      // swallow — UI shows skeletons / empty
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch entity counts (data normalization) ──
  const refreshCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/data-normalization', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setEntityCounts(data.counts ?? {});
      }
    } catch {
      // swallow
    }
  }, []);

  // ── Fetch sync queue + auto-sync status (PHASE 2B) ──
  const refreshQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/sync-queue', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setQueueItems(data.queue ?? []);
        setAutoSyncStatus(data.status ?? null);
      }
    } catch {
      // swallow
    }
  }, []);

  useEffect(() => {
    refresh();
    refreshCounts();
    refreshQueue();
  }, [refresh, refreshCounts, refreshQueue]);

  // ── Auto-poll every 15s while something is syncing ──
  useEffect(() => {
    const t = setInterval(() => {
      if (connections.some((c) => c.syncStatus === 'syncing')) refresh();
      refreshQueue();
    }, 15000);
    return () => clearInterval(t);
  }, [connections, refresh, refreshQueue]);

  // ── Listen for connections-updated (from ConnectDataDialog / sync / disconnect) ──
  useEffect(() => {
    const handler = () => { refresh(); refreshCounts(); refreshQueue(); };
    window.addEventListener('connections-updated', handler);
    return () => window.removeEventListener('connections-updated', handler);
  }, [refresh, refreshCounts, refreshQueue]);

  // ── Actions ──
  const openConnect = (tab?: 'gstn' | 'bank') => {
    window.dispatchEvent(new CustomEvent('open-connect-dialog', { detail: tab ? { tab } : {} }));
  };

  // PHASE 2B — Auto Sync Engine actions
  const runDueSyncs = async () => {
    setRunningSync(true);
    try {
      await fetch('/api/auto-sync/run', { method: 'POST' });
      await Promise.all([refresh(), refreshQueue()]);
      window.dispatchEvent(new CustomEvent('connections-updated'));
    } catch {
      // swallow
    } finally {
      setRunningSync(false);
    }
  };

  const toggleAutoSync = useCallback(async (conn: ConnectionRow) => {
    const newAuto = !conn.autoSync;
    setConnections((prev) => prev.map((c) => c.id === conn.id ? { ...c, autoSync: newAuto } : c));
    try {
      await fetch(`/api/connections/${conn.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSync: newAuto }),
      });
      window.dispatchEvent(new CustomEvent('connections-updated'));
    } catch {
      // swallow
    }
  }, []);

  const updateInterval = useCallback(async (conn: ConnectionRow, intervalMins: number) => {
    setConnections((prev) => prev.map((c) => c.id === conn.id ? { ...c, syncIntervalMins: intervalMins } : c));
    try {
      await fetch(`/api/connections/${conn.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncIntervalMins: intervalMins }),
      });
    } catch {
      // swallow
    }
  }, []);

  const handleSync = useCallback(async (conn: ConnectionRow) => {
    setSyncingIds((s) => new Set(s).add(conn.id));
    // Optimistic: flip to syncing
    setConnections((prev) => prev.map((c) => c.id === conn.id ? { ...c, syncStatus: 'syncing' } : c));
    try {
      const res = await fetch(`/api/connections/${conn.id}/sync`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const updated = data.connection ?? {};
        setConnections((prev) => prev.map((c) => {
          if (c.id !== conn.id) return c;
          return {
            ...c,
            syncStatus: updated.syncStatus ?? 'connected',
            lastSyncedAt: updated.lastSyncedAt ?? new Date().toISOString(),
            lastSyncRecords: updated.lastSyncRecords ?? c.lastSyncRecords,
            lastSyncErrors: updated.lastSyncErrors ?? 0,
            lastSyncMessage: updated.lastSyncMessage ?? 'Synced',
          };
        }));
        window.dispatchEvent(new CustomEvent('connections-updated'));
      }
    } catch {
      setConnections((prev) => prev.map((c) => c.id === conn.id ? { ...c, syncStatus: 'failed' } : c));
    } finally {
      setSyncingIds((s) => { const n = new Set(s); n.delete(conn.id); return n; });
    }
  }, []);

  const handleDisconnect = useCallback((conn: ConnectionRow) => {
    const name = conn.type === 'gstn' ? 'GSTN' : conn.provider;
    setPendingDisconnect({ id: conn.id, name });
    setConfirmDialogOpen(true);
  }, []);

  const confirmDisconnect = useCallback(async () => {
    setConfirmDialogOpen(false);
    const pending = pendingDisconnect;
    if (!pending) return;
    try {
      await fetch(`/api/connections/${pending.id}`, { method: 'DELETE' });
      window.dispatchEvent(new CustomEvent('connections-updated'));
      refresh();
    } catch {
      // swallow
    } finally {
      setPendingDisconnect(null);
    }
  }, [pendingDisconnect, refresh]);

  const openLogs = useCallback(async (conn: ConnectionRow) => {
    setLogsFor(conn);
    setLogsOpen(true);
    setLogsLoading(true);
    setLogs([]);
    try {
      const res = await fetch(`/api/connections/${conn.id}/logs`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
      }
    } catch {
      // swallow
    } finally {
      setLogsLoading(false);
    }
  }, []);

  // ── Derived ──
  const gstnConn = connections.find((c) => c.type === 'gstn');
  const bankConns = connections.filter((c) => c.type === 'bank');
  const connectedBankProviders = new Set(bankConns.map((b) => b.provider));
  const totalRecords = connections.reduce((s, c) => s + (c.lastSyncRecords ?? 0), 0);
  const totalErrors = connections.reduce((s, c) => s + (c.lastSyncErrors ?? 0), 0);
  const anySyncing = connections.some((c) => c.syncStatus === 'syncing');
  const anyFailed = connections.some((c) => c.syncStatus === 'failed' || c.syncStatus === 'partial');
  const autoSyncCount = connections.filter((c) => c.autoSync).length;
  const latestSync = connections.reduce<string | null>((latest, c) => {
    if (!c.lastSyncedAt) return latest;
    if (!latest) return c.lastSyncedAt;
    return new Date(c.lastSyncedAt) > new Date(latest) ? c.lastSyncedAt : latest;
  }, null);

  return (
    <div className="min-h-[calc(100vh-120px)] px-1 pb-10">
      {/* ═══ Header ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <div className="mb-1 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl accent-gradient-soft">
              <Database className="h-5 w-5 accent-text" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Data Connections<span className="accent-text">™</span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Real-time sync center for GSTN &amp; Banking. Oracle reads from this live data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={runDueSyncs}
            disabled={runningSync || connections.length === 0}
            className="gap-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
          >
            {runningSync ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Run Due Syncs
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refresh(); refreshCounts(); refreshQueue(); }}
            disabled={loading}
            className="gap-2 border-border bg-card"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => openConnect()}
            className="gap-2 accent-gradient accent-text font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            Connect Source
          </Button>
        </div>
      </motion.div>

      {/* ═══ Sync Summary Strip ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        <SummaryCard
          icon={Activity}
          label="Connected Sources"
          value={loading ? '—' : `${connections.length}`}
          hint={loading ? 'Loading…' : `${gstnConn ? 'GSTN' : ''}${bankConns.length ? `${gstnConn ? ' + ' : ''}${bankConns.length} bank${bankConns.length > 1 ? 's' : ''}` : ''}${!connections.length ? 'None yet' : ''}`}
          tone="default"
        />
        <SummaryCard
          icon={Database}
          label="Records Imported"
          value={loading ? '—' : totalRecords.toLocaleString('en-IN')}
          hint="Across all sources"
          tone="default"
        />
        <SummaryCard
          icon={anySyncing ? Loader2 : anyFailed ? AlertTriangle : CheckCircle2}
          label="Sync Status"
          value={loading ? '—' : anySyncing ? 'Syncing' : anyFailed ? 'Needs attention' : 'Healthy'}
          hint={loading ? 'Loading…' : anySyncing ? 'Live sync in progress' : anyFailed ? `${totalErrors} error${totalErrors !== 1 ? 's' : ''} detected` : 'All sources synced'}
          tone={anySyncing ? 'info' : anyFailed ? 'warn' : 'good'}
          spin={anySyncing}
        />
        <SummaryCard
          icon={Clock}
          label="Last Sync"
          value={loading ? '—' : timeAgo(latestSync)}
          hint={loading ? 'Loading…' : 'Most recent sync'}
          tone="default"
        />
      </motion.section>

      {/* ═══ PHASE 2B · Auto Sync Engine ═══ */}
      <AutoSyncSection
        connections={connections}
        autoSyncStatus={autoSyncStatus}
        queueItems={queueItems}
        runningSync={runningSync}
        onRunDueSyncs={runDueSyncs}
        onToggleAutoSync={toggleAutoSync}
        onUpdateInterval={updateInterval}
      />

      {/* ═══ Connected Services ═══ */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Connected Services
          </h2>
          {anyFailed && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => connections.filter((c) => c.syncStatus === 'failed' || c.syncStatus === 'partial').forEach(handleSync)}
              className="gap-2 border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry Failed
            </Button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[0, 1].map((i) => <Skeleton key={i} className="h-56 rounded-2xl bg-card" />)}
          </div>
        ) : connections.length === 0 ? (
          <EmptyState
            icon={Unplug}
            title="No data sources connected"
            description="Connect GSTN and your bank account to unlock live financial intelligence. Oracle answers from real data — not assumptions."
            ctaLabel="[ Connect Your First Source ]"
            onCta={() => openConnect()}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {connections.map((conn, i) => (
              <ConnectionCard
                key={conn.id}
                conn={conn}
                delay={0.05 * i}
                syncing={syncingIds.has(conn.id)}
                onSync={() => handleSync(conn)}
                onDisconnect={() => handleDisconnect(conn)}
                onViewLogs={() => openLogs(conn)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ═══ Available Services (connect more) ═══ */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Available Services
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {/* GSTN */}
          <AvailableCard
            icon={Building2}
            name="GSTN Portal"
            desc="GSTR-1, 3B, 2B, 9, Notices, E-Invoice, E-Way Bill, Ledgers"
            connected={!!gstnConn}
            onConnect={() => openConnect('gstn')}
          />
          {/* Banks */}
          {ALL_BANKS.map((bk) => (
            <AvailableCard
              key={bk}
              icon={Landmark}
              name={BANK_META[bk].label}
              desc="Balances, transactions, statements, auto-categorised"
              connected={connectedBankProviders.has(bk)}
              onConnect={() => openConnect('bank')}
            />
          ))}
        </div>
      </section>

      {/* ═══ Data Normalization Engine (MODULE 3) ═══ */}
      <section className="mb-4">
        <div className="mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Unified Data Model
          </h2>
          <span className="text-xs text-muted-foreground/60">— normalized entities across all sources</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 lg:grid-cols-10">
          {ENTITY_DEFS.map(([key, Icon]) => (
            <div
              key={key as string}
              className="rounded-xl border border-border bg-card p-3 text-center"
            >
              <Icon className="mx-auto mb-1.5 h-4 w-4 text-muted-foreground" />
              <div className="text-lg font-semibold text-foreground">
                {entityCounts[key as keyof EntityCounts] ?? 0}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {(key as string).replace(/([A-Z])/g, ' $1').trim()}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ Logs Sheet ═══ */}
      <Sheet open={logsOpen} onOpenChange={setLogsOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col" style={{ background: 'var(--card)' }}>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {logsFor?.type === 'gstn' ? <Building2 className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
              Sync Logs
            </SheetTitle>
            <SheetDescription>
              Import history &amp; error logs for {logsFor?.type === 'gstn' ? 'GSTN' : logsFor?.provider}.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            {logsLoading ? (
              <div className="space-y-2 py-4">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl bg-background" />)}
              </div>
            ) : logs.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No sync history yet.
              </div>
            ) : (
              <div className="space-y-2 py-4">
                {logs.map((log) => {
                  const meta = LOG_STATUS_META[log.status] ?? LOG_STATUS_META.success;
                  const Icon = meta.icon;
                  const errs = log.errorDetail ? safeParseErrors(log.errorDetail) : [];
                  return (
                    <div
                      key={log.id}
                      className="rounded-xl border border-border bg-background/60 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon className={cn('h-4 w-4 shrink-0', meta.color, log.status === 'syncing' && 'animate-spin')} />
                          <div>
                            <div className="text-sm font-medium text-foreground">{meta.label}</div>
                            <div className="text-xs text-muted-foreground">{log.message ?? '—'}</div>
                          </div>
                        </div>
                        <div className="text-right text-[11px] text-muted-foreground">
                          <div>{new Date(log.startedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                          {log.completedAt && (
                            <div>{Math.round((new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()))}ms</div>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Database className="h-3 w-3" /> {log.recordsImported} records</span>
                        {log.errorsCount > 0 && (
                          <span className="flex items-center gap-1 text-rose-400"><AlertCircle className="h-3 w-3" /> {log.errorsCount} errors</span>
                        )}
                      </div>
                      {errs.length > 0 && (
                        <div className="mt-2 rounded-lg border border-rose-500/20 bg-rose-500/5 p-2">
                          {errs.map((e, i) => (
                            <div key={i} className="text-[11px] text-rose-300">• {e}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* ═══ Disconnect Confirmation Dialog ═══ */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDisconnect ? `Disconnect ${pendingDisconnect.name}?` : 'Disconnect?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Live data from this source will stop syncing. You can reconnect anytime.
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
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ icon: Icon, label, value, hint, tone = 'default', spin = false }: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'good' | 'warn' | 'info';
  spin?: boolean;
}) {
  const toneColor = {
    default: 'text-foreground',
    good: 'text-emerald-400',
    warn: 'text-amber-400',
    info: 'text-cyan-400',
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn('h-4 w-4', toneColor, spin && 'animate-spin')} />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className={cn('text-xl font-semibold', toneColor)}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ConnectionCard({ conn, delay, syncing, onSync, onDisconnect, onViewLogs }: {
  conn: ConnectionRow;
  delay: number;
  syncing: boolean;
  onSync: () => void;
  onDisconnect: () => void;
  onViewLogs: () => void;
}) {
  const isGstn = conn.type === 'gstn';
  const meta = SYNC_STATUS_META[conn.syncStatus] ?? SYNC_STATUS_META.connected;
  const isBusy = syncing || conn.syncStatus === 'syncing';
  const isFailed = conn.syncStatus === 'failed' || conn.syncStatus === 'partial';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5"
    >
      {/* Accent stripe */}
      <div className={cn('absolute left-0 top-0 h-full w-1', isGstn ? 'accent-gradient' : 'bg-foreground/20')} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
            style={{ background: isGstn ? 'linear-gradient(135deg,#2563EB,#3B82F6)' : BANK_META[conn.provider]?.color ?? '#334155' }}
          >
            {isGstn ? <Building2 className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {isGstn ? 'GSTN Portal' : (BANK_META[conn.provider]?.label ?? conn.provider)}
            </h3>
            <div className="text-xs text-muted-foreground">
              {isGstn ? (conn.tradeName ?? conn.legalName ?? '—') : (conn.summary.kind === 'bank' ? `A/c ${conn.summary.maskedAccount}` : conn.maskedRef ?? '—')}
            </div>
            {isGstn && conn.gstin && (
              <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">{conn.gstin}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', meta.dot, isBusy && 'animate-pulse')} />
          <span className={cn('text-xs font-medium', meta.color)}>{meta.label}</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Records" value={(conn.lastSyncRecords ?? 0).toLocaleString('en-IN')} />
        <Stat label="Errors" value={String(conn.lastSyncErrors ?? 0)} tone={conn.lastSyncErrors ? 'warn' : 'default'} />
        <Stat label="Last Sync" value={timeAgo(conn.lastSyncedAt)} />
      </div>
      {/* PHASE 2B — duration + next sync */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Stat label="Duration" value={formatDuration(conn.lastSyncDurationMs)} />
        <Stat label="Next Sync" value={conn.nextSyncAt ? timeUntil(conn.nextSyncAt) : 'Manual'} tone={conn.autoSync ? 'default' : 'default'} />
        <Stat label="Quality" value={`${conn.lastValidationScore ?? 100}/100`} tone={(conn.lastValidationScore ?? 100) < 70 ? 'warn' : 'default'} />
      </div>

      {/* Source-specific detail */}
      {conn.summary.kind === 'gstn' ? (
        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
          <DetailChip label="Compliance" value={`${conn.summary.complianceScore}/100`} />
          <DetailChip label="Pending" value={String(conn.summary.pendingReturns)} />
          <DetailChip label="Notices" value={String(conn.summary.activeNotices)} tone={conn.summary.activeNotices ? 'warn' : 'default'} />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <DetailChip label="Balance" value={inrShort(conn.summary.closingBalance)} />
          <DetailChip label="Monthly Coll." value={inrShort(conn.summary.monthlyCollections)} />
        </div>
      )}

      {/* Last message */}
      {conn.lastSyncMessage && (
        <div className={cn('mt-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px]', isFailed ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400')}>
          {isFailed ? <AlertTriangle className="h-3 w-3 shrink-0" /> : <CheckCircle2 className="h-3 w-3 shrink-0" />}
          <span className="truncate">{conn.lastSyncMessage}</span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onSync}
          disabled={isBusy}
          className="gap-1.5 border-border bg-background text-xs"
        >
          <RefreshCw className={cn('h-3 w-3', isBusy && 'animate-spin')} />
          {isBusy ? 'Syncing…' : 'Sync Now'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onViewLogs}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ScrollText className="h-3 w-3" />
          Logs
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDisconnect}
          className="ml-auto gap-1.5 text-xs text-muted-foreground hover:text-rose-400"
        >
          <Unplug className="h-3 w-3" />
        </Button>
      </div>
    </motion.div>
  );
}

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warn' }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('text-sm font-semibold', tone === 'warn' ? 'text-amber-400' : 'text-foreground')}>{value}</div>
    </div>
  );
}

function DetailChip({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warn' }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-background/40 px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-medium', tone === 'warn' ? 'text-amber-400' : 'text-foreground')}>{value}</span>
    </div>
  );
}

function AvailableCard({ icon: Icon, name, desc, connected, onConnect }: {
  icon: LucideIcon;
  name: string;
  desc: string;
  connected: boolean;
  onConnect: () => void;
}) {
  return (
    <div className={cn(
      'rounded-xl border p-3 transition-colors',
      connected ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-border bg-card hover:bg-background/60',
    )}>
      <div className="mb-1.5 flex items-center justify-between">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {connected ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Plus className="h-3.5 w-3.5 text-muted-foreground/50" />
        )}
      </div>
      <div className="text-xs font-semibold text-foreground leading-tight">{name}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">{desc}</div>
      {!connected && (
        <button
          onClick={onConnect}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-md accent-gradient-soft py-1 text-[10px] font-medium accent-text transition-colors hover:opacity-80"
        >
          <Zap className="h-2.5 w-2.5" />
          Connect
        </button>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, ctaLabel, onCta }: {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl accent-gradient-soft">
        <Icon className="h-7 w-7 accent-text" />
      </div>
      <h3 className="mb-1.5 text-base font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">{description}</p>
      <Button onClick={onCta} className="gap-2 accent-gradient accent-text font-semibold">
        <Plus className="h-4 w-4" />
        {ctaLabel}
      </Button>
    </div>
  );
}

// ─── PHASE 2B · Auto Sync Engine helpers ──────────────────────────────────────

function formatDuration(ms?: number): string {
  if (!ms || ms === 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function timeUntil(iso?: string | null): string {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'due now';
  const m = Math.floor(diff / 60000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  return `in ${h}h ${m % 60}m`;
}

const QUEUE_STATUS_META: Record<string, { label: string; color: string }> = {
  queued: { label: 'Queued', color: 'text-zinc-400' },
  running: { label: 'Running', color: 'text-cyan-400' },
  done: { label: 'Done', color: 'text-emerald-400' },
  failed: { label: 'Failed', color: 'text-rose-400' },
  cancelled: { label: 'Cancelled', color: 'text-muted-foreground' },
};

const INTERVAL_OPTIONS = [5, 15, 30, 60, 180, 360];

function AutoSyncSection({
  connections,
  autoSyncStatus,
  queueItems,
  runningSync,
  onRunDueSyncs,
  onToggleAutoSync,
  onUpdateInterval,
}: {
  connections: ConnectionRow[];
  autoSyncStatus: AutoSyncStatusRow | null;
  queueItems: QueueItemRow[];
  runningSync: boolean;
  onRunDueSyncs: () => void;
  onToggleAutoSync: (conn: ConnectionRow) => void;
  onUpdateInterval: (conn: ConnectionRow, intervalMins: number) => void;
}) {
  if (connections.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="mb-8"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Zap className="h-4 w-4 text-emerald-400" />
          Auto Sync Engine<span className="text-emerald-400">™</span>
        </h2>
        {autoSyncStatus && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {autoSyncStatus.autoSyncEnabled > 0 ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Active
              </span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> Paused
              </span>
            )}
            {autoSyncStatus.dueNow > 0 && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-400">
                {autoSyncStatus.dueNow} due
              </span>
            )}
            {autoSyncStatus.queueDepth > 0 && (
              <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-cyan-400">
                {autoSyncStatus.queueDepth} queued
              </span>
            )}
            {autoSyncStatus.running > 0 && (
              <span className="flex items-center gap-1 text-cyan-400">
                <Loader2 className="h-3 w-3 animate-spin" /> {autoSyncStatus.running} running
              </span>
            )}
          </div>
        )}
      </div>

      {/* Schedule cards */}
      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {connections.map((conn) => (
          <ScheduleCard
            key={conn.id}
            conn={conn}
            onToggle={() => onToggleAutoSync(conn)}
            onUpdateInterval={(v) => onUpdateInterval(conn, v)}
          />
        ))}
      </div>

      {/* Queue panel */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Activity className="h-3.5 w-3.5" /> Sync Queue
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRunDueSyncs}
            disabled={runningSync}
            className="h-7 gap-1.5 text-xs"
          >
            {runningSync ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Process Now
          </Button>
        </div>
        {queueItems.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Queue is empty — all syncs are up to date.
          </div>
        ) : (
          <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
            {queueItems.slice(0, 12).map((q) => {
              const meta = QUEUE_STATUS_META[q.status] ?? QUEUE_STATUS_META.queued;
              return (
                <div key={q.id} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    {q.status === 'running' && <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />}
                    <div>
                      <span className="font-medium text-foreground">{q.connectionLabel}</span>
                      <span className="ml-2 text-muted-foreground">
                        {q.trigger} · attempt {q.attempts}/{q.maxAttempts} · {timeAgo(q.scheduledAt)}
                      </span>
                    </div>
                  </div>
                  <span className={cn('font-medium', meta.color)}>{meta.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.section>
  );
}

function ScheduleCard({
  conn,
  onToggle,
  onUpdateInterval,
}: {
  conn: ConnectionRow;
  onToggle: () => void;
  onUpdateInterval: (intervalMins: number) => void;
}) {
  const isGstn = conn.type === 'gstn';
  const interval = conn.syncIntervalMins ?? 15;

  return (
    <div className={cn(
      'rounded-2xl border bg-card p-4',
      conn.autoSync ? 'border-emerald-500/20' : 'border-border',
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
            style={{ background: isGstn ? 'linear-gradient(135deg,#2563EB,#3B82F6)' : '#334155' }}
          >
            {isGstn ? <Building2 className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isGstn ? 'GSTN' : (BANK_META[conn.provider]?.label ?? conn.provider)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {conn.autoSync
                ? `Every ${interval}m · next ${conn.nextSyncAt ? timeUntil(conn.nextSyncAt) : '—'}`
                : 'Manual sync only'}
            </p>
          </div>
        </div>
        {/* Toggle switch */}
        <button
          onClick={onToggle}
          className={cn(
            'relative h-6 w-11 rounded-full transition-colors',
            conn.autoSync ? 'bg-emerald-500' : 'bg-muted-foreground/30',
          )}
          aria-label={conn.autoSync ? 'Pause auto-sync' : 'Enable auto-sync'}
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
              conn.autoSync ? 'translate-x-[22px]' : 'translate-x-0.5',
            )}
          />
        </button>
      </div>
      {conn.autoSync && (
        <div className="mt-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">Interval:</span>
          <div className="flex flex-wrap gap-1">
            {INTERVAL_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => onUpdateInterval(opt)}
                className={cn(
                  'rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
                  interval === opt
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-background/40 text-muted-foreground hover:text-foreground',
                )}
              >
                {opt < 60 ? `${opt}m` : `${opt / 60}h`}
              </button>
            ))}
          </div>
        </div>
      )}
      {conn.consecutiveFailures && conn.consecutiveFailures > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-400">
          <AlertCircle className="h-3 w-3" />
          {conn.consecutiveFailures} consecutive failure{conn.consecutiveFailures === 1 ? '' : 's'} — retrying with backoff
        </div>
      )}
    </div>
  );
}

// ─── Log status meta ──────────────────────────────────────────────────────────
const LOG_STATUS_META: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  success:   { label: 'Success',  color: 'text-emerald-400', icon: CheckCircle2 },
  syncing:   { label: 'Syncing',  color: 'text-cyan-400',    icon: Loader2 },
  partial:   { label: 'Partial',  color: 'text-amber-400',   icon: AlertTriangle },
  failed:    { label: 'Failed',   color: 'text-rose-400',    icon: AlertCircle },
};

function safeParseErrors(raw: string): string[] {
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p.map(String);
    if (typeof p === 'string') return [p];
    return [];
  } catch {
    return [raw];
  }
}
