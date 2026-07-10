'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — PHASE 2B · MODULE 4 — Real-Time Alert Center™
//
// Command center for every alert raised by the change-detection engine.
// API: GET /api/alerts, POST /api/alerts (mark-all-read), PATCH /api/alerts/[id].
// Auto-refreshes every 30s + listens for `connections-updated` after syncs.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  BellRing, TrendingUp, TrendingDown, FileWarning, Wallet, AlertCircle,
  CheckCircle2, CheckCheck, RefreshCw, Archive, X, CheckCircle,
  CalendarClock, ArrowUpRight, ArrowDownRight, Activity, Bell,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertSeverity = 'critical' | 'warning' | 'info' | 'positive';
type AlertStatus = 'open' | 'read' | 'archived' | 'dismissed';
type FilterTab = 'all' | 'critical' | 'warning' | 'positive' | 'info' | 'archived';
type PatchAction = 'read' | 'dismiss' | 'archive' | 'resolve';

interface AlertRow {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  sourceType?: string;
  sourceId?: string;
  status: AlertStatus;
  actionUrl?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
  ackedAt?: string;
  resolvedAt?: string;
}

interface AlertSummary {
  total: number; open: number; critical: number;
  warning: number; info: number; positive: number;
}

// ─── Severity metadata ────────────────────────────────────────────────────────

interface SeverityMeta {
  label: string; text: string; bg: string; border: string;
  dot: string; glow: string; icon: LucideIcon;
}

const SEVERITY_META: Record<AlertSeverity, SeverityMeta> = {
  critical: { label: 'Critical', text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/50', dot: 'bg-red-500', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.35)]', icon: AlertCircle },
  warning:  { label: 'Warning',  text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/50', dot: 'bg-amber-500', glow: 'shadow-[0_0_12px_rgba(245,158,11,0.35)]', icon: FileWarning },
  positive: { label: 'Positive', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', dot: 'bg-emerald-500', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.35)]', icon: CheckCircle2 },
  info:     { label: 'Info',     text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/50', dot: 'bg-blue-500', glow: 'shadow-[0_0_12px_rgba(59,130,246,0.35)]', icon: Bell },
};

// ─── Type → icon mapping ──────────────────────────────────────────────────────

const TYPE_ICON: Record<string, LucideIcon> = {
  NEW_NOTICE: BellRing, NOTICE_RESOLVED: CheckCircle2,
  ITC_INCREASED: TrendingUp, ITC_DECREASED: TrendingDown,
  RETURN_OVERDUE: FileWarning, RETURN_FILED: CheckCircle, NEW_RETURN: CalendarClock,
  COLLECTION_DROPPED: ArrowDownRight, COLLECTION_SURGE: ArrowUpRight,
  CASH_POSITION_CHANGED: Wallet, REVENUE_CHANGED: Activity,
  COMPLIANCE_CHANGED: CheckCircle2, SYNC_COMPLETED: CheckCircle, SYNC_FAILED: AlertCircle,
};

// Module-scope component so the react-hooks/static-components rule stays happy.
function TypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = TYPE_ICON[type] ?? Bell;
  return <Icon className={className} />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
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

function formatFull(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function prettyJson(payload?: Record<string, unknown>): string {
  if (!payload) return '—';
  try { return JSON.stringify(payload, null, 2); } catch { return String(payload); }
}

// Severity tabs fetch all open+read alerts then filter client-side; the
// archived tab fetches archived directly; "all" fetches open+read.
function statusToParam(tab: FilterTab): AlertStatus | 'all' {
  return tab === 'archived' ? 'archived' : 'all';
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AlertsPage() {
  const { setCurrentView } = useApp();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actioningIds, setActioningIds] = useState<Set<string>>(new Set());
  const [markingAll, setMarkingAll] = useState(false);

  // ── Fetch alerts ──
  const refresh = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch(`/api/alerts?status=${statusToParam(activeTab)}&limit=100`, { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch failed');
      const data = (await res.json()) as { ok: boolean; alerts: AlertRow[]; summary: AlertSummary };
      if (data.ok) {
        setAlerts(data.alerts ?? []);
        setSummary(data.summary ?? null);
      }
    } catch {
      if (!silent) toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => { setLoading(true); refresh(); }, [refresh]);

  // ── Auto-poll every 30s + listen for connections-updated ──
  useEffect(() => {
    const t = setInterval(() => refresh(true), 30_000);
    const handler = () => refresh(true);
    window.addEventListener('connections-updated', handler);
    return () => { clearInterval(t); window.removeEventListener('connections-updated', handler); };
  }, [refresh]);

  const visibleAlerts = useMemo(() => {
    if (activeTab === 'all' || activeTab === 'archived') return alerts;
    return alerts.filter((a) => a.severity === activeTab);
  }, [alerts, activeTab]);

  const selectedAlert = useMemo(
    () => alerts.find((a) => a.id === selectedId) ?? null,
    [alerts, selectedId],
  );

  // ── Patch one alert (read/dismiss/archive/resolve) ──
  const patchAlert = useCallback(async (id: string, action: PatchAction) => {
    setActioningIds((s) => new Set(s).add(id));
    // Optimistic local update
    setAlerts((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      if (action === 'read') return { ...a, status: 'read', ackedAt: new Date().toISOString() };
      return { ...a, status: action === 'resolve' ? 'archived' : action, resolvedAt: new Date().toISOString() };
    }));
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('patch failed');
      const verb = action === 'read' ? 'Marked as read' : action === 'dismiss' ? 'Dismissed' : action === 'archive' ? 'Archived' : 'Resolved';
      toast.success(verb);
      refresh(true);
    } catch {
      toast.error('Action failed');
      refresh(true);
    } finally {
      setActioningIds((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }, [refresh]);

  // ── Mark all open alerts as read ──
  const markAllRead = useCallback(async () => {
    setMarkingAll(true);
    setAlerts((prev) => prev.map((a) => a.status === 'open' ? { ...a, status: 'read', ackedAt: new Date().toISOString() } : a));
    setSummary((s) => (s ? { ...s, open: 0 } : s));
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-all-read' }),
      });
      if (!res.ok) throw new Error('mark-all failed');
      const data = (await res.json()) as { ok: boolean; updated: number };
      if (data.ok) toast.success(data.updated > 0 ? `Marked ${data.updated} alert${data.updated === 1 ? '' : 's'} as read` : 'Nothing to mark');
      refresh(true);
    } catch {
      toast.error('Failed to mark all read');
      refresh(true);
    } finally {
      setMarkingAll(false);
    }
  }, [refresh]);

  const handleNavigate = useCallback((actionUrl?: string) => {
    if (!actionUrl) return;
    setCurrentView(actionUrl as never);
  }, [setCurrentView]);

  const openCount = summary?.open ?? 0;

  // ═══════════════════════════════════════════════════════════════════════════
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <BellRing className="h-5 w-5 text-foreground" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Alerts<span className="accent-text">™</span>
            </h1>
            {openCount > 0 && (
              <Badge className="ml-1 border-red-500/30 bg-red-500/15 text-red-300">
                {openCount} new
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Real-time alerts from your connected data sources
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm" onClick={markAllRead}
            disabled={markingAll || openCount === 0}
            className="border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] hover:text-foreground"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mark All Read</span>
            <span className="sm:hidden">Mark All</span>
          </Button>
          <Button
            variant="outline" size="sm" onClick={() => refresh()} disabled={refreshing}
            className="border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] hover:text-foreground"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </motion.div>

      {/* ═══ Summary Strip ═══ */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Critical" count={summary?.critical ?? 0} severity="critical" loading={loading} />
        <SummaryCard label="Warning"  count={summary?.warning ?? 0}  severity="warning"  loading={loading} />
        <SummaryCard label="Positive" count={summary?.positive ?? 0} severity="positive" loading={loading} />
        <SummaryCard label="Info"     count={summary?.info ?? 0}     severity="info"     loading={loading} />
      </div>

      {/* ═══ Filter Tabs ═══ */}
      <div className="mb-4 -mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max items-center gap-1">
          {([
            { id: 'all', label: 'All', accent: 'bg-foreground' },
            { id: 'critical', label: 'Critical', accent: 'bg-red-500' },
            { id: 'warning', label: 'Warning', accent: 'bg-amber-500' },
            { id: 'positive', label: 'Positive', accent: 'bg-emerald-500' },
            { id: 'info', label: 'Info', accent: 'bg-blue-500' },
            { id: 'archived', label: 'Archived', accent: 'bg-foreground' },
          ] as { id: FilterTab; label: string; accent: string }[]).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground hover:bg-white/[0.03] hover:text-foreground',
                )}
              >
                {tab.label}
                {active && (
                  <motion.span
                    layoutId="alert-tab-underline"
                    className={cn('absolute inset-x-2 -bottom-1 h-0.5 rounded-full', tab.accent)}
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ Alert List ═══ */}
      {loading ? (
        <AlertListSkeleton />
      ) : visibleAlerts.length === 0 ? (
        <EmptyAlerts tab={activeTab} />
      ) : (
        <div className="flex flex-col gap-2.5">
          <AnimatePresence mode="popLayout" initial={false}>
            {visibleAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onOpen={() => setSelectedId(alert.id)}
                onMarkRead={() => patchAlert(alert.id, 'read')}
                onArchive={() => patchAlert(alert.id, 'archive')}
                onDismiss={() => patchAlert(alert.id, 'dismiss')}
                onNavigate={() => handleNavigate(alert.actionUrl)}
                busy={actioningIds.has(alert.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ═══ Detail Sheet ═══ */}
      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent
          side="right"
          className="w-full border-white/[0.08] bg-[#0a0a0a]/95 backdrop-blur-xl sm:max-w-md"
        >
          {selectedAlert ? (
            <AlertDetail
              alert={selectedAlert}
              onMarkRead={() => patchAlert(selectedAlert.id, 'read')}
              onArchive={() => patchAlert(selectedAlert.id, 'archive')}
              onDismiss={() => patchAlert(selectedAlert.id, 'dismiss')}
              onResolve={() => patchAlert(selectedAlert.id, 'resolve')}
              onNavigate={() => handleNavigate(selectedAlert.actionUrl)}
              busy={actioningIds.has(selectedAlert.id)}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Skeleton className="h-40 w-full" />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function SummaryCard({
  label, count, severity, loading,
}: { label: string; count: number; severity: AlertSeverity; loading: boolean }) {
  const meta = SEVERITY_META[severity];
  const Icon = meta.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('relative overflow-hidden rounded-2xl border bg-white/[0.03] p-4', meta.border)}
    >
      <div className={cn('absolute left-0 top-0 h-full w-1', meta.dot)} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', meta.bg)}>
            <Icon className={cn('h-4 w-4', meta.text)} />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        {count > 0 && <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot, meta.glow)} />}
      </div>
      <div className="mt-3">
        {loading ? (
          <Skeleton className="h-8 w-12" />
        ) : (
          <span className={cn('text-2xl font-semibold tabular-nums', meta.text)}>{count}</span>
        )}
      </div>
    </motion.div>
  );
}

function AlertCard({
  alert, onOpen, onMarkRead, onArchive, onDismiss, onNavigate, busy,
}: {
  alert: AlertRow;
  onOpen: () => void;
  onMarkRead: () => void;
  onArchive: () => void;
  onDismiss: () => void;
  onNavigate: () => void;
  busy: boolean;
}) {
  const meta = SEVERITY_META[alert.severity];
  const isOpen = alert.status === 'open';
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-white/[0.03] p-3.5 transition-colors hover:bg-white/[0.05] sm:p-4',
        meta.border, isOpen && 'border-l-2',
      )}
    >
      <div className="flex items-start gap-3">
        <button onClick={onOpen} className="flex shrink-0 items-center gap-2 pt-0.5 outline-none" aria-label={`Open alert: ${alert.title}`}>
          <span className={cn('relative flex h-2.5 w-2.5', isOpen && 'animate-pulse')}>
            <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60', meta.dot)} />
            <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', meta.dot)} />
          </span>
          <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', meta.bg)}>
            <TypeIcon type={alert.type} className={cn('h-4 w-4', meta.text)} />
          </span>
        </button>

        <button onClick={onOpen} className="min-w-0 flex-1 text-left outline-none">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{alert.title}</h3>
            {isOpen && (
              <Badge variant="outline" className={cn('border-current px-1.5 py-0 text-[10px]', meta.text)}>NEW</Badge>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{alert.message}</p>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground/80">
            <span>{timeAgo(alert.createdAt)}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="uppercase tracking-wide">{alert.type.replace(/_/g, ' ')}</span>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          {isOpen && (
            <IconButton icon={CheckCheck} label="Mark Read" onClick={onMarkRead} disabled={busy} hover="hover:text-emerald-400" />
          )}
          {alert.actionUrl && (
            <IconButton icon={ArrowUpRight} label="Open" onClick={onNavigate} disabled={busy} hover="hover:text-foreground" />
          )}
          <IconButton icon={Archive} label="Archive" onClick={onArchive} disabled={busy} hover="hover:text-amber-400" />
          <IconButton icon={X} label="Dismiss" onClick={onDismiss} disabled={busy} hover="hover:text-red-400" />
        </div>
      </div>
    </motion.div>
  );
}

function IconButton({
  icon: Icon, label, onClick, disabled, hover,
}: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; hover: string }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled} aria-label={label} title={label}
      className={cn('flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.06] disabled:opacity-40', hover)}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function AlertDetail({
  alert, onMarkRead, onArchive, onDismiss, onResolve, onNavigate, busy,
}: {
  alert: AlertRow;
  onMarkRead: () => void; onArchive: () => void;
  onDismiss: () => void; onResolve: () => void;
  onNavigate: () => void; busy: boolean;
}) {
  const meta = SEVERITY_META[alert.severity];
  return (
    <ScrollArea className="h-full">
      <SheetHeader className="gap-2 border-b border-white/[0.06] pr-8">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', meta.bg)}>
            <TypeIcon type={alert.type} className={cn('h-5 w-5', meta.text)} />
          </div>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-base font-semibold text-foreground">{alert.title}</SheetTitle>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline" className={cn('border-current px-1.5 py-0 text-[10px]', meta.text)}>{meta.label}</Badge>
              <Badge variant="outline" className="border-white/[0.08] bg-white/[0.03] px-1.5 py-0 text-[10px] uppercase tracking-wide">
                {alert.type.replace(/_/g, ' ')}
              </Badge>
              <span className="text-[11px] text-muted-foreground">{timeAgo(alert.createdAt)}</span>
            </div>
          </div>
        </div>
      </SheetHeader>

      <div className="flex flex-col gap-4 p-4">
        <section>
          <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">Message</h4>
          <p className="text-sm leading-relaxed text-foreground/90">{alert.message}</p>
        </section>

        <section>
          <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">Source & Lifecycle</h4>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs">
            <Row label="Source Type" value={alert.sourceType ?? 'system'} />
            {alert.sourceId && <Row label="Source ID" value={alert.sourceId} mono />}
            <Row label="Status" value={<span className="capitalize">{alert.status}</span>} />
            <Row label="Created" value={formatFull(alert.createdAt)} />
            <Row label="Acknowledged" value={formatFull(alert.ackedAt)} />
            <Row label="Resolved" value={formatFull(alert.resolvedAt)} />
            {alert.actionUrl && (
              <Row
                label="Action"
                value={
                  <button onClick={onNavigate} className="inline-flex items-center gap-1 text-emerald-400 hover:underline">
                    Open in {alert.actionUrl}
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                }
              />
            )}
          </div>
        </section>

        {alert.payload && Object.keys(alert.payload).length > 0 && (
          <section>
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">Payload</h4>
            <pre className="max-h-72 overflow-auto rounded-lg border border-white/[0.06] bg-black/40 p-3 text-[11px] leading-relaxed text-foreground/80">
              {prettyJson(alert.payload)}
            </pre>
          </section>
        )}

        <section className="flex flex-wrap gap-2 pt-1">
          {alert.status === 'open' && (
            <Button size="sm" onClick={onMarkRead} disabled={busy}
              className="border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25">
              <CheckCheck className="h-3.5 w-3.5" /> Mark Read
            </Button>
          )}
          {alert.actionUrl && (
            <Button size="sm" variant="outline" onClick={onNavigate} disabled={busy}
              className="border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] hover:text-foreground">
              <ArrowUpRight className="h-3.5 w-3.5" /> Open
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onArchive} disabled={busy}
            className="border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] hover:text-amber-400">
            <Archive className="h-3.5 w-3.5" /> Archive
          </Button>
          <Button size="sm" variant="outline" onClick={onResolve} disabled={busy}
            className="border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] hover:text-emerald-400">
            <CheckCircle className="h-3.5 w-3.5" /> Resolve
          </Button>
          <Button size="sm" variant="outline" onClick={onDismiss} disabled={busy}
            className="ml-auto border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] hover:text-red-400">
            <X className="h-3.5 w-3.5" /> Dismiss
          </Button>
        </section>
      </div>
    </ScrollArea>
  );
}

function Row({
  label, value, mono,
}: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn('text-right text-foreground/90', mono && 'font-mono text-[11px]')}>{value}</span>
    </div>
  );
}

function AlertListSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function EmptyAlerts({ tab }: { tab: FilterTab }) {
  const isArchived = tab === 'archived';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] py-16 text-center"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
        {isArchived ? (
          <Archive className="h-7 w-7 text-muted-foreground" />
        ) : (
          <CheckCircle2 className="h-7 w-7 text-emerald-400" />
        )}
      </div>
      <h3 className="text-sm font-semibold text-foreground">
        {isArchived ? 'No archived alerts' : 'All clear — no pending alerts'}
      </h3>
      <p className="mt-1.5 max-w-xs text-xs text-muted-foreground">
        {isArchived
          ? 'Alerts you archive will appear here for your records.'
          : 'When GSTPilot detects changes in your connected data, alerts will appear here in real time.'}
      </p>
    </motion.div>
  );
}
