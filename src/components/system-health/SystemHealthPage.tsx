'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — PHASE 2B · MODULE 6 — Observability Dashboard™
//
// System Health™ screen. Shows connector health, sync metrics, queue depth,
// error logs, data quality, and auto-sync status. Auto-refreshes every 30s.
//
// GET /api/system-health → SystemHealthPayload
// POST /api/auto-sync/run → trigger due syncs now
// POST /api/sync-queue → process the queue now
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, AlertCircle, ArrowUpRight, CheckCircle2, Clock, Database,
  Gauge, Loader2, RefreshCw, Server, Zap, AlertTriangle, ListChecks,
  TrendingUp, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// ─── Types (mirror SystemHealthPayload from lib/connections/observability.ts) ───

interface ServiceHealth {
  name: string;
  type: 'gstn' | 'bank';
  status: 'up' | 'degraded' | 'down' | 'disconnected';
  uptimePct: number;
  lastSync?: string;
  lastSyncDurationMs: number;
  consecutiveFailures: number;
  recordsImported: number;
  lastError?: string;
  syncStatus: string;
  connectionId?: string;
}

interface ErrorLogEntry {
  id: string;
  source: 'sync' | 'validation' | 'system';
  severity: 'error' | 'warning';
  message: string;
  detail?: string;
  connectionLabel?: string;
  timestamp: string;
}

interface QueueItem {
  id: string;
  connectionLabel: string;
  status: string;
  trigger: string;
  attempts: number;
  scheduledAt: string;
}

interface SystemHealthPayload {
  computedAt: string;
  services: ServiceHealth[];
  metrics: {
    gstnUptime: number;
    bankUptime: number;
    averageSyncTimeMs: number;
    failureRate: number;
    successRate: number;
    totalSyncs24h: number;
    totalRecordsImported: number;
    dataQualityScore: number;
    apiLatencyMs: number;
  };
  queue: {
    depth: number;
    running: number;
    recent: QueueItem[];
  };
  errorLogs: ErrorLogEntry[];
  alertSummary: {
    total: number;
    open: number;
    critical: number;
    warning: number;
  };
  autoSyncStatus: {
    totalConnections: number;
    autoSyncEnabled: number;
    dueNow: number;
    queueDepth: number;
    running: number;
    nextRunAt?: string;
    lastRunAt?: string;
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso?: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function timeUntil(iso?: string): string {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'due now';
  const m = Math.floor(diff / 60000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  return `in ${h}h ${m % 60}m`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const STATUS_META: Record<string, { label: string; color: string; dot: string; icon: typeof CheckCircle2 }> = {
  up: { label: 'Operational', color: 'text-emerald-400', dot: 'bg-emerald-400', icon: CheckCircle2 },
  degraded: { label: 'Degraded', color: 'text-amber-400', dot: 'bg-amber-400', icon: AlertTriangle },
  down: { label: 'Down', color: 'text-red-400', dot: 'bg-red-400', icon: AlertCircle },
  disconnected: { label: 'Disconnected', color: 'text-zinc-500', dot: 'bg-zinc-500', icon: AlertCircle },
};

const SERVICE_ICON: Record<string, typeof Database> = {
  gstn: Database,
  bank: Server,
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningSync, setRunningSync] = useState(false);

  const fetchHealth = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch('/api/system-health', { cache: 'no-store' });
      const data = await res.json();
      if (data.ok && data.health) setHealth(data.health);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(() => fetchHealth(true), 30000);
    const onUpdate = () => fetchHealth(true);
    window.addEventListener('connections-updated', onUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('connections-updated', onUpdate);
    };
  }, [fetchHealth]);

  const runDueSyncs = async () => {
    setRunningSync(true);
    try {
      await fetch('/api/auto-sync/run', { method: 'POST' });
      await fetchHealth(true);
    } catch {
      /* ignore */
    } finally {
      setRunningSync(false);
    }
  };

  const processQueue = async () => {
    setRunningSync(true);
    try {
      await fetch('/api/sync-queue', { method: 'POST' });
      await fetchHealth(true);
    } catch {
      /* ignore */
    } finally {
      setRunningSync(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-white/[0.04]" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.04]" />
      </div>
    );
  }

  const m = health?.metrics;
  const a = health?.autoSyncStatus;

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 px-6 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">System Health™</h1>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Observability dashboard for live connectors, sync pipeline, and data quality.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={processQueue}
            disabled={runningSync}
            className="gap-2 border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07]"
          >
            {runningSync ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Process Queue
          </Button>
          <Button
            size="sm"
            onClick={runDueSyncs}
            disabled={runningSync}
            className="gap-2 bg-emerald-600 hover:bg-emerald-500"
          >
            {runningSync ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Run Due Syncs
          </Button>
        </div>
      </div>

      {/* Auto-Sync Status Banner */}
      {a && (
        <div className="mx-6 mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Zap className="h-3.5 w-3.5 text-emerald-400" />
            Auto-Sync Engine
          </span>
          <span className="text-muted-foreground">
            Status: <span className={a.autoSyncEnabled > 0 ? 'text-emerald-400' : 'text-zinc-400'}>
              {a.autoSyncEnabled > 0 ? 'Active' : 'Paused'}
            </span>
          </span>
          <span className="text-muted-foreground">
            Connections: <span className="text-foreground">{a.totalConnections}</span>
          </span>
          <span className="text-muted-foreground">
            Queue: <span className="text-foreground">{a.queueDepth}</span> pending
          </span>
          <span className="text-muted-foreground">
            Running: <span className="text-foreground">{a.running}</span>
          </span>
          <span className="text-muted-foreground">
            Last run: <span className="text-foreground">{timeAgo(a.lastRunAt)}</span>
          </span>
          <span className="text-muted-foreground">
            Next run: <span className="text-foreground">{timeUntil(a.nextRunAt)}</span>
          </span>
          {a.dueNow > 0 && (
            <Badge className="bg-amber-500/15 text-amber-400 hover:bg-amber-500/20">
              {a.dueNow} due now
            </Badge>
          )}
        </div>
      )}

      {/* Metrics Grid */}
      {m && (
        <div className="grid grid-cols-2 gap-3 px-6 md:grid-cols-4">
          <MetricCard
            icon={TrendingUp}
            label="GSTN Uptime"
            value={`${m.gstnUptime}%`}
            tone={m.gstnUptime >= 95 ? 'good' : m.gstnUptime >= 80 ? 'warn' : 'bad'}
            delay={0}
          />
          <MetricCard
            icon={TrendingUp}
            label="Bank Uptime"
            value={`${m.bankUptime}%`}
            tone={m.bankUptime >= 95 ? 'good' : m.bankUptime >= 80 ? 'warn' : 'bad'}
            delay={0.05}
          />
          <MetricCard
            icon={Clock}
            label="Avg Sync Time"
            value={formatMs(m.averageSyncTimeMs)}
            tone="neutral"
            delay={0.1}
          />
          <MetricCard
            icon={AlertCircle}
            label="Failure Rate"
            value={`${m.failureRate}%`}
            tone={m.failureRate <= 5 ? 'good' : m.failureRate <= 20 ? 'warn' : 'bad'}
            delay={0.15}
          />
          <MetricCard
            icon={CheckCircle2}
            label="Success Rate"
            value={`${m.successRate}%`}
            tone={m.successRate >= 95 ? 'good' : m.successRate >= 80 ? 'warn' : 'bad'}
            delay={0.2}
          />
          <MetricCard
            icon={Database}
            label="Records Imported"
            value={m.totalRecordsImported.toLocaleString('en-IN')}
            sub={`${m.totalSyncs24h} syncs / 24h`}
            tone="neutral"
            delay={0.25}
          />
          <MetricCard
            icon={ShieldCheck}
            label="Data Quality"
            value={`${m.dataQualityScore}/100`}
            tone={m.dataQualityScore >= 80 ? 'good' : m.dataQualityScore >= 60 ? 'warn' : 'bad'}
            delay={0.3}
          />
          <MetricCard
            icon={Gauge}
            label="API Latency"
            value={formatMs(m.apiLatencyMs)}
            tone={m.apiLatencyMs < 500 ? 'good' : m.apiLatencyMs < 2000 ? 'warn' : 'bad'}
            delay={0.35}
          />
        </div>
      )}

      {/* Services */}
      <div className="mt-8 px-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Server className="h-4 w-4" /> Connected Services
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {health?.services.map((svc, i) => (
            <ServiceCard key={svc.connectionId ?? i} svc={svc} delay={i * 0.08} />
          ))}
          {(!health?.services || health.services.length === 0) && (
            <div className="col-span-full rounded-2xl border border-white/[0.06] bg-white/[0.02] py-12 text-center text-sm text-muted-foreground">
              No connected services. Visit Data Connections to connect GSTN or Bank.
            </div>
          )}
        </div>
      </div>

      {/* Queue + Error Logs */}
      <div className="mt-8 grid grid-cols-1 gap-6 px-6 lg:grid-cols-2">
        {/* Sync Queue */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <ListChecks className="h-4 w-4" /> Sync Queue
            </h2>
            {health?.queue && (
              <div className="flex items-center gap-2 text-xs">
                {health.queue.running > 0 && (
                  <Badge className="bg-blue-500/15 text-blue-400 hover:bg-blue-500/20">
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" /> {health.queue.running} running
                  </Badge>
                )}
                <Badge className="bg-white/[0.06] text-muted-foreground hover:bg-white/[0.1]">
                  {health.queue.depth} queued
                </Badge>
              </div>
            )}
          </div>
          {health?.queue.recent && health.queue.recent.length > 0 ? (
            <ScrollArea className="max-h-72">
              <div className="space-y-2 pr-2">
                {health.queue.recent.map((q) => (
                  <QueueRow key={q.id} item={q} />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Queue is empty — all syncs are up to date.
            </div>
          )}
        </div>

        {/* Error Logs */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <AlertTriangle className="h-4 w-4" /> Error Logs
            </h2>
            {health?.errorLogs && health.errorLogs.length > 0 && (
              <Badge className="bg-red-500/10 text-red-400 hover:bg-red-500/15">
                {health.errorLogs.length} recent
              </Badge>
            )}
          </div>
          {health?.errorLogs && health.errorLogs.length > 0 ? (
            <ScrollArea className="max-h-72">
              <div className="space-y-2 pr-2">
                {health.errorLogs.map((log) => (
                  <ErrorLogRow key={log.id} entry={log} />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400/60" />
              No errors — all systems healthy.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  delay,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  sub?: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  delay: number;
}) {
  const toneColor = {
    good: 'text-emerald-400',
    warn: 'text-amber-400',
    bad: 'text-red-400',
    neutral: 'text-foreground',
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="mb-2 flex items-center justify-between">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className={cn('text-2xl font-bold tabular-nums', toneColor)}>{value}</p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground/70">{sub}</p>}
    </motion.div>
  );
}

function ServiceCard({ svc, delay }: { svc: ServiceHealth; delay: number }) {
  const meta = STATUS_META[svc.status] ?? STATUS_META.disconnected;
  const StatusIcon = meta.icon;
  const SvcIcon = SERVICE_ICON[svc.type] ?? Database;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={cn(
        'rounded-2xl border bg-white/[0.02] p-5',
        svc.status === 'down' ? 'border-red-500/30' : svc.status === 'degraded' ? 'border-amber-500/30' : 'border-white/[0.06]',
      )}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', svc.type === 'gstn' ? 'bg-blue-500/10' : 'bg-purple-500/10')}>
            <SvcIcon className={cn('h-5 w-5', svc.type === 'gstn' ? 'text-blue-400' : 'text-purple-400')} />
          </div>
          <div>
            <p className="font-semibold text-foreground">{svc.name}</p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{svc.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', meta.dot, svc.status !== 'up' && 'animate-pulse')} />
          <span className={cn('text-xs font-medium', meta.color)}>{meta.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Uptime (24h)</p>
          <p className={cn('font-semibold tabular-nums', svc.uptimePct >= 95 ? 'text-emerald-400' : svc.uptimePct >= 80 ? 'text-amber-400' : 'text-red-400')}>
            {svc.uptimePct}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Last Sync</p>
          <p className="font-medium text-foreground">{timeAgo(svc.lastSync)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Duration</p>
          <p className="font-medium text-foreground">{formatMs(svc.lastSyncDurationMs)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Records</p>
          <p className="font-medium text-foreground">{svc.recordsImported.toLocaleString('en-IN')}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Sync Status</p>
          <p className={cn('font-medium', svc.syncStatus === 'connected' ? 'text-emerald-400' : svc.syncStatus === 'syncing' ? 'text-blue-400' : svc.syncStatus === 'failed' ? 'text-red-400' : 'text-amber-400')}>
            {svc.syncStatus}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Failures</p>
          <p className={cn('font-medium', svc.consecutiveFailures > 0 ? 'text-red-400' : 'text-foreground')}>
            {svc.consecutiveFailures}
          </p>
        </div>
      </div>

      {svc.lastError && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-500/5 p-2.5 text-xs text-red-400">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span className="line-clamp-2">{svc.lastError}</span>
        </div>
      )}
    </motion.div>
  );
}

function QueueRow({ item }: { item: QueueItem }) {
  const statusMeta: Record<string, { color: string; label: string }> = {
    queued: { color: 'text-zinc-400', label: 'Queued' },
    running: { color: 'text-blue-400', label: 'Running' },
    done: { color: 'text-emerald-400', label: 'Done' },
    failed: { color: 'text-red-400', label: 'Failed' },
    cancelled: { color: 'text-zinc-500', label: 'Cancelled' },
  };
  const meta = statusMeta[item.status] ?? statusMeta.queued;

  return (
    <div className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
      <div className="flex items-center gap-2.5">
        {item.status === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />}
        <div>
          <p className="text-sm font-medium text-foreground">{item.connectionLabel}</p>
          <p className="text-[11px] text-muted-foreground">
            {item.trigger} · attempt {item.attempts} · {timeAgo(item.scheduledAt)}
          </p>
        </div>
      </div>
      <span className={cn('text-xs font-medium', meta.color)}>{meta.label}</span>
    </div>
  );
}

function ErrorLogRow({ entry }: { entry: ErrorLogEntry }) {
  const isError = entry.severity === 'error';
  return (
    <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {isError ? (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-400" />
          ) : (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground line-clamp-1">{entry.message}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {entry.source} · {entry.connectionLabel ?? 'system'} · {timeAgo(entry.timestamp)}
            </p>
          </div>
        </div>
      </div>
      {entry.detail && (
        <p className="mt-1.5 pl-5 text-[11px] text-muted-foreground/70 line-clamp-2">{entry.detail}</p>
      )}
    </div>
  );
}
