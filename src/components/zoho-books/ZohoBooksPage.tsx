'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books · Premium Business Sync Center
// ═══════════════════════════════════════════════════════════════════════════════
//
// A business-grade control center for Zoho Books accounting sync. No
// developer-looking layouts, no token / data-center / raw-ID fields visible —
// only business information an operator or finance lead cares about.
//
// All underlying behaviour is preserved:
//   • OAuth connect / disconnect via /api/integrations/zoho/{connect,disconnect}
//   • Token refresh via /api/integrations/zoho/refresh
//   • Sync trigger + status polling via /api/integrations/zoho/sync{,/status}
//   • Customer list auto-loaded via /api/integrations/zoho/customers
//
// Sections:
//   1. Overview Header — connection status, health score ring, sync KPIs
//   2. Sync History Timeline — Today / Yesterday / Last Week buckets
//   3. Accounting Summary — 8-card grid (Invoices, Bills, Customers, …)
//   4. Modules Synced — 8 module cards with per-module refresh
//   5. Outstanding & Revenue — three big metrics with count-up animation
//   6. Recent Accounting Activity — latest invoices/customers/payments/expenses
//   7. Oracle AI Insights — overdue, outstanding, cash flow, profit
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Clock,
  Activity,
  PlayCircle,
  Users,
  FileText,
  Receipt,
  Banknote,
  Landmark,
  BookOpen,
  Percent,
  CreditCard,
  Package,
  Wallet,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Layers,
  Database,
  IndianRupee,
  AlertTriangle,
} from 'lucide-react';
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
import { useBusinessSnapshot } from '@/hooks/useBusinessSnapshot';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

type DayBucket = 'today' | 'yesterday' | 'lastWeek' | 'older' | 'none';

function dayBucket(iso: string | null | undefined): DayBucket {
  if (!iso) return 'none';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'none';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((startOfToday.getTime() - d.getTime()) / 86_400_000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays <= 7) return 'lastWeek';
  return 'older';
}

function formatINR(n: number): string {
  if (!Number.isFinite(n)) return '₹0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

function formatINRFull(n: number): string {
  if (!Number.isFinite(n)) return '₹0';
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─── Count-up animation hook ──────────────────────────────────────────────────

function useCountUp(target: number, durationMs = 800): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      setValue(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = target;
    };
  }, [target, durationMs]);

  return value;
}

function CountUp({
  value,
  format,
}: {
  value: number;
  format: (n: number) => string;
}) {
  const animated = useCountUp(value);
  return <span className="gst-animate-count tabular-nums">{format(animated)}</span>;
}

// ─── Zoho brand mark (red Z tile) ─────────────────────────────────────────────

function ZohoBooksLogo({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/[0.08] ${
        className ?? ''
      }`}
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

// ─── Health Score Ring ────────────────────────────────────────────────────────

function HealthRing({ score, label }: { score: number; label: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = c - (clamped / 100) * c;
  const tone =
    score >= 80 ? '#3B82F6' : score >= 60 ? '#F59E0B' : score >= 40 ? '#F97316' : '#EF4444';
  const animated = useCountUp(clamped);

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-16 shrink-0">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="6"
          />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={tone}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{
              transition:
                'stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1), stroke 0.3s ease',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-bold tabular-nums text-foreground">
            {Math.round(animated)}
          </span>
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Health Score
        </span>
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </div>
    </div>
  );
}

// ─── Module & summary-card metadata ───────────────────────────────────────────

interface ModuleMeta {
  key: ZohoSyncEntity;
  label: string;
  icon: typeof Users;
  /** Tailwind classes for the icon tile background + icon color. */
  tone: string;
}

const MODULE_META: ModuleMeta[] = [
  { key: 'customer', label: 'Customers', icon: Users, tone: 'bg-[#2563EB]/12 text-[#60A5FA]' },
  { key: 'invoice', label: 'Invoices', icon: FileText, tone: 'bg-[#8B5CF6]/12 text-[#A78BFA]' },
  { key: 'bill', label: 'Bills', icon: Receipt, tone: 'bg-[#F59E0B]/12 text-[#FBBF24]' },
  { key: 'payment', label: 'Payments', icon: CreditCard, tone: 'bg-[#10B981]/12 text-[#34D399]' },
  { key: 'expense', label: 'Expenses', icon: Banknote, tone: 'bg-[#EF4444]/12 text-[#F87171]' },
  { key: 'journal', label: 'Journals', icon: BookOpen, tone: 'bg-[#06B6D4]/12 text-[#22D3EE]' },
  { key: 'bank_account', label: 'Bank', icon: Landmark, tone: 'bg-[#EC4899]/12 text-[#F472B6]' },
  { key: 'tax', label: 'Taxes', icon: Percent, tone: 'bg-[#14B8A6]/12 text-[#2DD4BF]' },
];

interface SummaryCardMeta {
  key: ZohoSyncEntity;
  label: string;
  icon: typeof Users;
  /** Tone for the icon tile. */
  tone: string;
  /** Whether this card has an amount metric (vs. just a count). */
  hasAmount?: boolean;
}

const SUMMARY_META: SummaryCardMeta[] = [
  { key: 'invoice', label: 'Invoices', icon: FileText, tone: 'bg-[#8B5CF6]/12 text-[#A78BFA]', hasAmount: true },
  { key: 'bill', label: 'Bills', icon: Receipt, tone: 'bg-[#F59E0B]/12 text-[#FBBF24]', hasAmount: true },
  { key: 'customer', label: 'Customers', icon: Users, tone: 'bg-[#2563EB]/12 text-[#60A5FA]' },
  { key: 'expense', label: 'Expenses', icon: Banknote, tone: 'bg-[#EF4444]/12 text-[#F87171]', hasAmount: true },
  { key: 'payment', label: 'Payments', icon: CreditCard, tone: 'bg-[#10B981]/12 text-[#34D399]', hasAmount: true },
  { key: 'creditnote', label: 'Credit Notes', icon: FileText, tone: 'bg-[#06B6D4]/12 text-[#22D3EE]' },
  { key: 'item', label: 'Items', icon: Package, tone: 'bg-[#EC4899]/12 text-[#F472B6]' },
  { key: 'bank_account', label: 'Bank Accounts', icon: Landmark, tone: 'bg-[#14B8A6]/12 text-[#2DD4BF]' },
];

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: typeof Users;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#181818] ring-1 ring-[#2A2A2A]">
            <Icon className="h-4 w-4 text-[#60A5FA]" />
          </div>
        ) : null}
        <div>
          <h2 className="gst-section-title text-foreground">{title}</h2>
          {description ? (
            <p className="gst-description mt-0.5">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// ─── 1. Overview Header ───────────────────────────────────────────────────────

function OverviewHeader() {
  const {
    status,
    statusLoading,
    connect,
    disconnect,
    refresh,
    pending,
    refreshStatus,
    syncStatus,
    syncing,
    triggerSync,
    refreshSyncStatus,
  } = useZohoBooks();
  const { snapshot } = useBusinessSnapshot();

  const [connectError, setConnectError] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [syncMode, setSyncMode] = useState<'incremental' | 'full'>('incremental');

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

  const confirmDisconnect = useCallback(async () => {
    setConfirmDialogOpen(false);
    const { error } = await disconnect();
    if (error) setConnectError(error);
  }, [disconnect]);

  const handleRefreshToken = useCallback(async () => {
    setConnectError(null);
    const { error } = await refresh();
    if (error) setConnectError(error);
  }, [refresh]);

  const handleSync = useCallback(async () => {
    setConnectError(null);
    const { ok, error } = await triggerSync({ mode: syncMode, resume: true });
    if (!ok && error) setConnectError(error);
  }, [triggerSync, syncMode]);

  const connected = !!status?.connected;
  const lastSync = syncStatus?.lastSync;
  const totalRecords = syncStatus?.totalRecords ?? 0;
  const modulesSynced = useMemo(
    () =>
      Object.values(syncStatus?.recordsImported ?? {}).filter(
        (c) => typeof c === 'number' && c > 0,
      ).length,
    [syncStatus?.recordsImported],
  );
  const lastSyncRelative = lastSync?.completedAt ?? lastSync?.startedAt;
  const healthScore = snapshot.healthScore;
  const healthLabel = snapshot.healthScoreLabel ?? (healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : healthScore >= 40 ? 'Fair' : 'Critical');

  return (
    <>
      <section className="gst-card gst-animate-in">
        <div className="flex flex-col gap-6">
          {/* Top row: brand + connection status + actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <ZohoBooksLogo className="h-12 w-12" />
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold tracking-tight text-foreground">
                    {status?.organizationName ?? 'Zoho Books'}
                  </h2>
                  {statusLoading ? (
                    <span className="gst-status gst-status-neutral">
                      <Loader2 className="h-3 w-3 animate-spin" /> Checking
                    </span>
                  ) : connected ? (
                    <span className="gst-status gst-status-success">
                      <CheckCircle2 className="h-3 w-3" /> Connected
                    </span>
                  ) : (
                    <span className="gst-status gst-status-danger">
                      <XCircle className="h-3 w-3" /> Disconnected
                    </span>
                  )}
                </div>
                <p className="gst-description">
                  {connected
                    ? 'Live two-way sync is active. Your accounting data flows into GSTPilot automatically.'
                    : 'Connect your Zoho Books organization to enable accounting sync, AI insights, and automated reconciliation.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void refreshStatus()}
                disabled={statusLoading}
                className="gst-btn gst-btn-ghost gst-btn-sm"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${statusLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              {connected ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshToken}
                    disabled={pending}
                    className="gst-btn gst-btn-outline gst-btn-sm"
                    title="Re-authorize Zoho Books connection"
                  >
                    {pending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    Reconnect
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDialogOpen(true)}
                    disabled={pending}
                    className="gst-btn gst-btn-outline gst-btn-sm border-[#EF4444]/30 text-[#F87171] hover:bg-[#EF4444]/10 hover:text-[#F87171] hover:border-[#EF4444]/40"
                  >
                    <Unplug className="h-3.5 w-3.5" />
                    Disconnect
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSync}
                    disabled={syncing}
                    className="gst-btn gst-btn-primary gst-btn-sm"
                  >
                    {syncing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PlayCircle className="h-3.5 w-3.5" />
                    )}
                    {syncing ? 'Syncing…' : 'Sync Now'}
                  </Button>
                  <div className="flex items-center gap-1 rounded-lg border border-[#2A2A2A] bg-[#181818] p-0.5">
                    <button
                      type="button"
                      onClick={() => setSyncMode('incremental')}
                      className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${
                        syncMode === 'incremental'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground'
                      }`}
                      aria-label="Incremental sync"
                    >
                      Incremental
                    </button>
                    <button
                      type="button"
                      onClick={() => setSyncMode('full')}
                      className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${
                        syncMode === 'full'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground'
                      }`}
                      aria-label="Full sync"
                    >
                      Full
                    </button>
                  </div>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={handleConnect}
                  disabled={pending}
                  className="gst-btn gst-btn-primary gst-btn-sm"
                >
                  {pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plug className="h-3.5 w-3.5" />
                  )}
                  Connect Zoho Books
                </Button>
              )}
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-4 border-t border-[#1F1F1F] pt-5 lg:grid-cols-4">
            {/* Health score (ring) */}
            <div className="gst-card gst-card-compact !border-0 !bg-transparent !p-0">
              <HealthRing score={healthScore} label={healthLabel} />
            </div>

            {/* Last Sync */}
            <OverviewKpi
              icon={Clock}
              tone="bg-[#8B5CF6]/12 text-[#A78BFA]"
              label="Last Sync"
              value={lastSyncRelative ? timeAgo(lastSyncRelative) : 'Never'}
              sub={lastSync?.completedAt ? formatTime(lastSync.completedAt) : 'No sync yet'}
            />

            {/* Modules Synced */}
            <OverviewKpi
              icon={Layers}
              tone="bg-[#2563EB]/12 text-[#60A5FA]"
              label="Modules Synced"
              value={`${modulesSynced} / ${MODULE_META.length}`}
              sub={connected ? 'Active data modules' : 'Connect to enable'}
              animateValue={modulesSynced}
              format={(n) => `${Math.round(n)} / ${MODULE_META.length}`}
            />

            {/* Records Imported */}
            <OverviewKpi
              icon={Database}
              tone="bg-[#10B981]/12 text-[#34D399]"
              label="Records Imported"
              value={totalRecords.toLocaleString('en-IN')}
              sub={lastSync?.mode ? `${lastSync.mode} sync` : 'Awaiting first sync'}
              animateValue={totalRecords}
              format={(n) => Math.round(n).toLocaleString('en-IN')}
            />
          </div>

          {/* Sync progress bar (when running) */}
          <AnimatePresence>
            {syncing ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-3 rounded-lg border border-[#2563EB]/25 bg-[#2563EB]/5 px-3 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#60A5FA]" />
                  <span className="flex-1 text-xs text-foreground">
                    {lastSync?.currentEntity
                      ? `Fetching ${
                          MODULE_META.find((m) => m.key === lastSync.currentEntity)?.label ??
                          lastSync.currentEntity
                        }…`
                      : 'Connecting to Zoho Books…'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void refreshSyncStatus()}
                    className="gst-btn gst-btn-ghost gst-btn-sm"
                  >
                    <RefreshCw className="h-3 w-3" /> Poll
                  </Button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Error / success banner */}
          {connectError ? (
            <div className="flex items-center gap-2 rounded-lg border border-[#EF4444]/25 bg-[#EF4444]/5 px-3 py-2 text-xs text-[#F87171]">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {connectError}
            </div>
          ) : null}

          {/* Trust strip */}
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
              Bank-grade encryption · AES-256-GCM at rest
            </span>
            <span className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-[#60A5FA]" />
              OAuth 2.0 · Multi-tenant
            </span>
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-[#A78BFA]" />
              India&apos;s leading accounting platform
            </span>
          </div>
        </div>
      </section>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Zoho Books?</AlertDialogTitle>
            <AlertDialogDescription>
              All synced customers, invoices, bills, and payments will remain in GSTPilot, but
              live sync will stop. You can reconnect anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDisconnect}
              className="bg-[#EF4444] text-white hover:bg-[#DC2626] focus:ring-[#EF4444]"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function OverviewKpi({
  icon: Icon,
  tone,
  label,
  value,
  sub,
  animateValue,
  format,
}: {
  icon: typeof Users;
  tone: string;
  label: string;
  value: string;
  sub?: string;
  animateValue?: number;
  format?: (n: number) => string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {animateValue !== undefined && format ? (
          <span className="gst-metric text-xl text-foreground">
            <CountUp value={animateValue} format={format} />
          </span>
        ) : (
          <span className="gst-metric text-xl text-foreground">{value}</span>
        )}
        {sub ? <span className="text-[10px] text-muted-foreground">{sub}</span> : null}
      </div>
    </div>
  );
}

// ─── 2. Sync History Timeline ─────────────────────────────────────────────────

interface TimelineEntry {
  entity: ZohoSyncEntity;
  label: string;
  icon: typeof Users;
  tone: string;
  count: number;
  status: 'synced' | 'partial' | 'error' | 'idle';
  timestamp: string | null;
}

function SyncHistoryTimeline() {
  const { syncStatus } = useZohoBooks();
  const lastSync = syncStatus?.lastSync;
  const stats = lastSync?.stats ?? {};
  const records = syncStatus?.recordsImported ?? {};

  // Build a flat list of timeline entries from the per-entity stats of the
  // last sync run. Each entity that has any activity becomes one entry.
  const entries: TimelineEntry[] = useMemo(() => {
    const out: TimelineEntry[] = [];
    const included = new Set<ZohoSyncEntity>();
    // First pass: entities with activity in the last sync stats.
    for (const meta of MODULE_META) {
      const s = stats[meta.key];
      const recCount = records[meta.key] ?? 0;
      const touched =
        s && (s.imported > 0 || s.updated > 0 || s.failed > 0 || s.pages > 0);
      if (!touched) continue;
      included.add(meta.key);
      let status: TimelineEntry['status'] = 'synced';
      if (s.failed > 0 && s.imported === 0 && s.updated === 0) status = 'error';
      else if (s.failed > 0) status = 'partial';
      out.push({
        entity: meta.key,
        label: meta.label,
        icon: meta.icon,
        tone: meta.tone,
        count: recCount,
        status,
        timestamp: lastSync?.completedAt ?? lastSync?.startedAt ?? null,
      });
    }
    // Second pass: entities with records but no activity in the last sync
    // stats (e.g. previously synced, no new changes).
    for (const meta of MODULE_META) {
      if (included.has(meta.key)) continue;
      const recCount = records[meta.key] ?? 0;
      if (recCount === 0) continue;
      out.push({
        entity: meta.key,
        label: meta.label,
        icon: meta.icon,
        tone: meta.tone,
        count: recCount,
        status: 'idle',
        timestamp: lastSync?.completedAt ?? lastSync?.startedAt ?? null,
      });
    }
    return out;
  }, [stats, records, lastSync]);

  // Group entries by day bucket.
  const bucketed = useMemo(() => {
    const groups: Record<DayBucket, TimelineEntry[]> = {
      today: [],
      yesterday: [],
      lastWeek: [],
      older: [],
      none: [],
    };
    for (const e of entries) {
      groups[dayBucket(e.timestamp)].push(e);
    }
    return groups;
  }, [entries]);

  const buckets: Array<{ key: DayBucket; label: string; emptyText: string }> = [
    { key: 'today', label: 'Today', emptyText: 'No syncs today yet.' },
    { key: 'yesterday', label: 'Yesterday', emptyText: 'Nothing synced yesterday.' },
    { key: 'lastWeek', label: 'Last Week', emptyText: 'No syncs in the last week.' },
  ];

  const hasAny = entries.length > 0;

  return (
    <section className="gst-card gst-animate-in">
      <SectionHeader
        title="Sync History"
        description="A timeline of what was synced, when, and how many records flowed in."
        icon={Clock}
      />
      {!hasAny ? (
        <div className="gst-empty-state">
          <div className="gst-empty-state-icon">
            <Clock className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="gst-empty-state-title">No syncs yet</p>
          <p className="gst-empty-state-desc">
            Once you run your first sync, every module — customers, invoices, bills, payments —
            will appear here as a timeline entry.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {buckets.map((b) => {
            const items = bucketed[b.key];
            return (
              <div key={b.key} className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {b.label}
                  </span>
                  <span className="h-px flex-1 bg-[#1F1F1F]" />
                  <span className="text-[10px] text-muted-foreground">
                    {items.length} {items.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="pl-1 text-xs text-muted-foreground/70">{b.emptyText}</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {items.map((e) => (
                      <TimelineRow key={`${b.key}-${e.entity}`} entry={e} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  const Icon = entry.icon;
  const StatusIcon =
    entry.status === 'synced'
      ? CheckCircle2
      : entry.status === 'partial'
        ? AlertCircle
        : entry.status === 'error'
          ? XCircle
          : Clock;
  const statusTone =
    entry.status === 'synced'
      ? 'text-[#34D399]'
      : entry.status === 'partial'
        ? 'text-[#FBBF24]'
        : entry.status === 'error'
          ? 'text-[#F87171]'
          : 'text-muted-foreground';
  const statusLabel =
    entry.status === 'synced'
      ? 'Synced'
      : entry.status === 'partial'
        ? 'Partial'
        : entry.status === 'error'
          ? 'Error'
          : 'Idle';

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#1F1F1F] bg-[#0F0F0F] px-3 py-2.5">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${entry.tone}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-medium text-foreground">{entry.label}</span>
        <span className="text-[10px] text-muted-foreground">
          {entry.count.toLocaleString('en-IN')} records ·{' '}
          {entry.timestamp ? timeAgo(entry.timestamp) : 'pending'}
        </span>
      </div>
      <div className={`flex items-center gap-1 text-[10px] font-medium ${statusTone}`}>
        <StatusIcon className="h-3 w-3" />
        {statusLabel}
      </div>
      <span className="hidden text-[10px] text-muted-foreground sm:inline">
        {entry.timestamp ? formatTime(entry.timestamp) : '—'}
      </span>
    </div>
  );
}

// ─── 3. Accounting Summary ────────────────────────────────────────────────────

function AccountingSummary() {
  const { syncStatus } = useZohoBooks();
  const { snapshot } = useBusinessSnapshot();
  const records = syncStatus?.recordsImported ?? {};

  // Amount lookups per summary card. We only show amounts for cards where we
  // have a real number from the business snapshot — never invented.
  const amountFor = useCallback(
    (key: ZohoSyncEntity): number | null => {
      switch (key) {
        case 'invoice':
          return snapshot.invoices.total;
        case 'bill':
          return snapshot.payables;
        case 'expense':
          return snapshot.expenses;
        case 'payment':
          return snapshot.collections.totalCollected;
        default:
          return null;
      }
    },
    [snapshot],
  );

  return (
    <section className="gst-animate-in">
      <SectionHeader
        title="Accounting Summary"
        description="Counts come from your Zoho Books sync; totals come from your live books."
        icon={Layers}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SUMMARY_META.map((card, idx) => {
          const count = records[card.key] ?? 0;
          const amount = card.hasAmount ? amountFor(card.key) : null;
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className="gst-card gst-card-hover gst-animate-in"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <div className="flex items-start justify-between">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.tone}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <div className="mt-4 flex flex-col gap-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {card.label}
                </span>
                <span className="gst-metric text-2xl text-foreground">
                  <CountUp
                    value={count}
                    format={(n) => Math.round(n).toLocaleString('en-IN')}
                  />
                </span>
                {card.hasAmount && amount !== null ? (
                  <span className="text-[11px] text-muted-foreground">
                    Total:{' '}
                    <span className="font-semibold text-foreground/80">
                      <CountUp value={amount} format={formatINR} />
                    </span>
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── 4. Modules Synced ────────────────────────────────────────────────────────

function ModulesSynced() {
  const { syncStatus, syncing, triggerSync } = useZohoBooks();
  const lastSync = syncStatus?.lastSync;
  const stats = lastSync?.stats ?? {};
  const records = syncStatus?.recordsImported ?? {};
  const [busyModule, setBusyModule] = useState<ZohoSyncEntity | null>(null);

  const handleRefreshModule = useCallback(
    async (entity: ZohoSyncEntity) => {
      setBusyModule(entity);
      // The Zoho sync API runs all modules in one shot. We trigger an
      // incremental sync — the engine resumes from the current entity.
      await triggerSync({ mode: 'incremental', resume: true });
      setBusyModule(null);
    },
    [triggerSync],
  );

  return (
    <section className="gst-animate-in">
      <SectionHeader
        title="Modules Synced"
        description="Each Zoho Books module as a card — last updated, status, and per-module refresh."
        icon={Database}
        action={
          <span className="gst-status gst-status-info">
            <Activity className="h-3 w-3" />
            {modulesActiveCount(records)} active
          </span>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MODULE_META.map((m, idx) => {
          const recCount = records[m.key] ?? 0;
          const s = stats[m.key];
          let status: 'synced' | 'syncing' | 'error' | 'idle' = 'idle';
          if (syncing && lastSync?.currentEntity === m.key) status = 'syncing';
          else if (s && s.failed > 0 && s.imported === 0 && s.updated === 0) status = 'error';
          else if (s && (s.imported > 0 || s.updated > 0 || s.pages > 0)) status = 'synced';
          else if (recCount > 0) status = 'synced';

          const Icon = m.icon;
          return (
            <div
              key={m.key}
              className="gst-card gst-card-hover gst-animate-in flex flex-col"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <div className="flex items-start justify-between">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${m.tone}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <ModuleStatusBadge status={status} />
              </div>
              <div className="mt-4 flex flex-col gap-0.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </span>
                <span className="gst-metric text-2xl text-foreground">
                  <CountUp
                    value={recCount}
                    format={(n) => Math.round(n).toLocaleString('en-IN')}
                  />
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {status === 'syncing'
                    ? 'Syncing now…'
                    : status === 'synced'
                      ? `Updated ${timeAgo(lastSync?.completedAt ?? lastSync?.startedAt)}`
                      : status === 'error'
                        ? 'Sync failed — retry'
                        : 'Awaiting first sync'}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-end border-t border-[#1F1F1F] pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleRefreshModule(m.key)}
                  disabled={syncing || busyModule === m.key}
                  className="gst-btn gst-btn-ghost gst-btn-sm"
                >
                  {syncing && busyModule === m.key ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Refresh
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function modulesActiveCount(records: Partial<Record<ZohoSyncEntity, number>>): number {
  return Object.values(records).filter((c) => typeof c === 'number' && c > 0).length;
}

function ModuleStatusBadge({
  status,
}: {
  status: 'synced' | 'syncing' | 'error' | 'idle';
}) {
  switch (status) {
    case 'syncing':
      return (
        <span className="gst-status gst-status-info">
          <Loader2 className="h-3 w-3 animate-spin" /> Syncing
        </span>
      );
    case 'synced':
      return (
        <span className="gst-status gst-status-success">
          <CheckCircle2 className="h-3 w-3" /> Synced
        </span>
      );
    case 'error':
      return (
        <span className="gst-status gst-status-danger">
          <XCircle className="h-3 w-3" /> Error
        </span>
      );
    case 'idle':
    default:
      return (
        <span className="gst-status gst-status-neutral">
          <Clock className="h-3 w-3" /> Idle
        </span>
      );
  }
}

// ─── 5. Outstanding & Revenue ─────────────────────────────────────────────────

function OutstandingRevenue() {
  const { snapshot } = useBusinessSnapshot();
  const outstanding = snapshot.collections.totalOutstanding || snapshot.invoices.outstanding;
  const revenue = snapshot.revenue;
  const profit = snapshot.profit;
  const isProfit = profit >= 0;

  return (
    <section className="gst-animate-in">
      <SectionHeader
        title="Outstanding & Revenue"
        description="Live financial KPIs from your books — updated on every sync."
        icon={Wallet}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Outstanding */}
        <div className="gst-card gst-animate-in relative overflow-hidden">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#F59E0B]/10 blur-2xl" />
          <div className="relative flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F59E0B]/12 text-[#FBBF24]">
              <AlertCircle className="h-4 w-4" />
            </div>
            <span className="gst-status gst-status-warning">
              <Clock className="h-3 w-3" /> Receivable
            </span>
          </div>
          <div className="relative mt-5 flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Outstanding Amount
            </span>
            <span className="gst-metric text-4xl text-foreground">
              <CountUp value={outstanding} format={formatINRFull} />
            </span>
            <span className="text-[11px] text-muted-foreground">
              Includes{' '}
              <span className="font-semibold text-[#FBBF24]">
                <CountUp value={snapshot.invoices.overdue} format={formatINR} />
              </span>{' '}
              overdue
            </span>
          </div>
        </div>

        {/* Revenue this month */}
        <div className="gst-card gst-animate-in relative overflow-hidden">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#2563EB]/10 blur-2xl" />
          <div className="relative flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB]/12 text-[#60A5FA]">
              <IndianRupee className="h-4 w-4" />
            </div>
            <span className="gst-status gst-status-success">
              <ArrowUpRight className="h-3 w-3" /> This Month
            </span>
          </div>
          <div className="relative mt-5 flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Revenue This Month
            </span>
            <span className="gst-metric text-4xl text-foreground">
              <CountUp value={revenue} format={formatINRFull} />
            </span>
            <span className="text-[11px] text-muted-foreground">
              Across{' '}
              <span className="font-semibold text-foreground/80">
                <CountUp
                  value={snapshot.invoices.count}
                  format={(n) => Math.round(n).toLocaleString('en-IN')}
                />
              </span>{' '}
              invoices
            </span>
          </div>
        </div>

        {/* Profit */}
        <div className="gst-card gst-animate-in relative overflow-hidden">
          <div
            className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl ${
              isProfit ? 'bg-[#10B981]/10' : 'bg-[#EF4444]/10'
            }`}
          />
          <div className="relative flex items-start justify-between">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                isProfit
                  ? 'bg-[#10B981]/12 text-[#34D399]'
                  : 'bg-[#EF4444]/12 text-[#F87171]'
              }`}
            >
              {isProfit ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
            </div>
            <span
              className={`gst-status ${
                isProfit ? 'gst-status-success' : 'gst-status-danger'
              }`}
            >
              {isProfit ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {isProfit ? 'Profit' : 'Loss'}
            </span>
          </div>
          <div className="relative mt-5 flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Net Profit
            </span>
            <span className="gst-metric text-4xl text-foreground">
              <CountUp value={profit} format={formatINRFull} />
            </span>
            <span className="text-[11px] text-muted-foreground">
              {snapshot.runway.isProfitable ? 'Profitable · ' : 'Burning cash · '}
              <span className="font-semibold text-foreground/80">
                {snapshot.runway.monthsRemaining !== null
                  ? `${snapshot.runway.monthsRemaining} mo runway`
                  : 'Runway ∞'}
              </span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 6. Recent Accounting Activity ────────────────────────────────────────────

interface RecentInvoice {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  client?: { tradeName?: string | null } | null;
}

interface RecentPayment {
  id: string;
  amount: number;
  partyName?: string | null;
  paymentMode?: string | null;
  direction?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

interface RecentExpense {
  id: string;
  category: string;
  vendor?: string | null;
  amount: number;
  date: string;
}

function useFetchJson<T>(url: string | null): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        // Inject the x-gstpilot-actor header so requireAuth() succeeds in
        // sandbox/preview mode (no Firebase Admin SDK to verify a bearer token).
        const actor = JSON.stringify({
          uid: user?.uid ?? 'local-user',
          email: user?.email ?? 'local@gstpilot.dev',
        });
        const res = await fetch(url, {
          cache: 'no-store',
          headers: { 'x-gstpilot-actor': actor },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as T;
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
          setLoading(false);
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [url, user]);

  return { data, loading, error };
}

function RecentActivity() {
  const { organization } = useOrg();
  const { customers } = useZohoBooks();

  const orgId = organization?.id ?? null;
  const invoicesUrl = orgId ? `/api/data/invoices?limit=5` : null;
  const paymentsUrl = orgId ? `/api/data/payments?limit=5` : null;
  const expensesUrl = orgId ? `/api/expenses?limit=5&organizationId=${encodeURIComponent(orgId)}` : null;

  const invoicesResp = useFetchJson<{ invoices: RecentInvoice[]; total: number }>(invoicesUrl);
  const paymentsResp = useFetchJson<{ payments: RecentPayment[]; total: number }>(paymentsUrl);
  const expensesResp = useFetchJson<{ expenses: RecentExpense[] }>(expensesUrl);

  const recentInvoices = invoicesResp.data?.invoices ?? [];
  const recentPayments = paymentsResp.data?.payments ?? [];
  const recentExpenses = expensesResp.data?.expenses ?? [];
  const recentCustomers = customers.slice(0, 5);

  return (
    <section className="gst-animate-in">
      <SectionHeader
        title="Recent Accounting Activity"
        description="The freshest invoices, customers, payments, and expenses from your books."
        icon={Activity}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <RecentListCard
          title="Latest Invoices"
          icon={FileText}
          tone="bg-[#8B5CF6]/12 text-[#A78BFA]"
          loading={invoicesResp.loading}
          error={invoicesResp.error}
          empty={recentInvoices.length === 0}
          emptyText="No invoices yet."
        >
          {recentInvoices.map((inv) => (
            <RecentRow
              key={inv.id}
              title={inv.invoiceNumber}
              subtitle={inv.client?.tradeName ?? 'Unknown client'}
              value={formatINR(inv.totalAmount)}
              meta={inv.paymentStatus ?? inv.status ?? '—'}
              timestamp={inv.createdAt}
            />
          ))}
        </RecentListCard>

        <RecentListCard
          title="Latest Customers"
          icon={Users}
          tone="bg-[#2563EB]/12 text-[#60A5FA]"
          loading={false}
          error={null}
          empty={recentCustomers.length === 0}
          emptyText="No synced customers yet."
        >
          {recentCustomers.map((c) => (
            <RecentRow
              key={c.id}
              title={c.contactName}
              subtitle={c.companyName ?? c.email ?? '—'}
              value={c.outstandingReceivable > 0 ? formatINR(c.outstandingReceivable) : '—'}
              meta={c.status}
              timestamp={c.lastSyncedAt}
              valueTone={c.outstandingReceivable > 0 ? 'text-[#FBBF24]' : 'text-muted-foreground'}
            />
          ))}
        </RecentListCard>

        <RecentListCard
          title="Latest Payments"
          icon={CreditCard}
          tone="bg-[#10B981]/12 text-[#34D399]"
          loading={paymentsResp.loading}
          error={paymentsResp.error}
          empty={recentPayments.length === 0}
          emptyText="No payments recorded yet."
        >
          {recentPayments.map((p) => (
            <RecentRow
              key={p.id}
              title={p.partyName ?? 'Payment'}
              subtitle={p.paymentMode ?? '—'}
              value={formatINR(p.amount)}
              meta={p.direction === 'out' ? 'Outgoing' : 'Incoming'}
              timestamp={p.paidAt ?? p.createdAt}
              valueTone={p.direction === 'out' ? 'text-[#F87171]' : 'text-[#34D399]'}
            />
          ))}
        </RecentListCard>

        <RecentListCard
          title="Latest Expenses"
          icon={Banknote}
          tone="bg-[#EF4444]/12 text-[#F87171]"
          loading={expensesResp.loading}
          error={expensesResp.error}
          empty={recentExpenses.length === 0}
          emptyText="No expenses recorded yet."
        >
          {recentExpenses.map((e) => (
            <RecentRow
              key={e.id}
              title={e.category}
              subtitle={e.vendor ?? '—'}
              value={formatINR(e.amount)}
              meta="Expense"
              timestamp={e.date}
              valueTone="text-[#F87171]"
            />
          ))}
        </RecentListCard>
      </div>
    </section>
  );
}

function RecentListCard({
  title,
  icon: Icon,
  tone,
  loading,
  error,
  empty,
  emptyText,
  children,
}: {
  title: string;
  icon: typeof Users;
  tone: string;
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <div className="gst-card gst-animate-in">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <h3 className="gst-card-title text-foreground">{title}</h3>
        </div>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      <div className="max-h-80 overflow-y-auto pr-1">
        {error ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#EF4444]/25 bg-[#EF4444]/5 px-3 py-2 text-xs text-[#F87171]">
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Icon className="mb-2 h-6 w-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">{emptyText}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">{children}</div>
        )}
      </div>
    </div>
  );
}

function RecentRow({
  title,
  subtitle,
  value,
  meta,
  timestamp,
  valueTone = 'text-foreground',
}: {
  title: string;
  subtitle: string;
  value: string;
  meta: string;
  timestamp: string;
  valueTone?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#1F1F1F] bg-[#0F0F0F] px-3 py-2.5 transition-colors hover:border-[#2A2A2A]">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-medium text-foreground">{title}</span>
        <span className="truncate text-[10px] text-muted-foreground">{subtitle}</span>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className={`text-xs font-semibold ${valueTone}`}>{value}</span>
        <span className="text-[10px] text-muted-foreground">{meta}</span>
      </div>
      <span className="hidden w-14 shrink-0 text-right text-[10px] text-muted-foreground sm:block">
        {timeAgo(timestamp)}
      </span>
    </div>
  );
}

// ─── 7. Oracle AI Insights ────────────────────────────────────────────────────

function OracleInsights() {
  const { snapshot } = useBusinessSnapshot();
  const { customers } = useZohoBooks();

  const overdueAmount = snapshot.invoices.overdue;
  const outstandingAmount = snapshot.collections.totalOutstanding || snapshot.invoices.outstanding;
  const cashBalance = snapshot.cash + snapshot.bankBalance;
  const profit = snapshot.profit;
  const isProfitable = snapshot.runway.isProfitable;
  const monthlyBurn = snapshot.runway.monthlyBurnRate;
  const monthsRemaining = snapshot.runway.monthsRemaining;

  // Derive "top overdue customers" from the synced customer list — sort by
  // outstandingReceivable desc, take top 3 with non-zero outstanding.
  const topOverdueCustomers = useMemo(() => {
    return customers
      .filter((c) => c.outstandingReceivable > 0)
      .sort((a, b) => b.outstandingReceivable - a.outstandingReceivable)
      .slice(0, 3);
  }, [customers]);

  const collectionRate = snapshot.collections.collectionRate;

  return (
    <section className="gst-card gst-animate-in">
      <SectionHeader
        title="Oracle AI Insights"
        description="Live, data-driven observations from your synced Zoho Books data."
        icon={Sparkles}
        action={
          <span className="gst-status gst-status-info">
            <Sparkles className="h-3 w-3" /> Auto-generated
          </span>
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top overdue customers */}
        <InsightCard
          icon={AlertTriangle}
          tone="bg-[#F59E0B]/12 text-[#FBBF24]"
          title="Top Overdue Customers"
          summary={
            topOverdueCustomers.length > 0
              ? `${topOverdueCustomers.length} customers owe you a combined ${formatINRFull(
                  topOverdueCustomers.reduce((s, c) => s + c.outstandingReceivable, 0),
                )}.`
              : 'No overdue customers right now. Outstanding receivables are healthy.'
          }
        >
          {topOverdueCustomers.length > 0 ? (
            <div className="flex flex-col gap-2">
              {topOverdueCustomers.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-[#1F1F1F] bg-[#0F0F0F] px-3 py-2"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-xs font-medium text-foreground">
                      {c.contactName}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {c.companyName ?? c.email ?? '—'}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-[#FBBF24]">
                    {formatINR(c.outstandingReceivable)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <InsightEmpty icon={CheckCircle2} text="All customers are current." />
          )}
        </InsightCard>

        {/* Outstanding invoices */}
        <InsightCard
          icon={FileText}
          tone="bg-[#8B5CF6]/12 text-[#A78BFA]"
          title="Outstanding Invoices"
          summary={`${formatINRFull(outstandingAmount)} is awaiting collection across ${
            snapshot.invoices.count
          } invoices. Collection rate is ${collectionRate.toFixed(1)}%.`}
        >
          <div className="grid grid-cols-3 gap-2">
            <InsightStat label="Outstanding" value={formatINR(outstandingAmount)} />
            <InsightStat label="Overdue" value={formatINR(overdueAmount)} tone="text-[#FBBF24]" />
            <InsightStat
              label="Avg Days to Pay"
              value={`${Math.round(snapshot.collections.averageDaysToPay)}d`}
            />
          </div>
        </InsightCard>

        {/* Cash flow summary */}
        <InsightCard
          icon={Wallet}
          tone="bg-[#2563EB]/12 text-[#60A5FA]"
          title="Cash Flow Summary"
          summary={`You have ${formatINRFull(
            cashBalance,
          )} in cash & bank. Projected cash next month: ${formatINR(snapshot.forecast.projectedCash)}.`}
        >
          <div className="grid grid-cols-3 gap-2">
            <InsightStat label="Cash" value={formatINR(snapshot.cash)} />
            <InsightStat label="Bank" value={formatINR(snapshot.bankBalance)} />
            <InsightStat
              label="Projected (next mo)"
              value={formatINR(snapshot.forecast.projectedCash)}
              tone="text-[#60A5FA]"
            />
          </div>
        </InsightCard>

        {/* Profit insights */}
        <InsightCard
          icon={isProfitable ? TrendingUp : TrendingDown}
          tone={
            isProfitable ? 'bg-[#10B981]/12 text-[#34D399]' : 'bg-[#EF4444]/12 text-[#F87171]'
          }
          title="Profit Insights"
          summary={
            isProfitable
              ? `You're profitable this period with ${formatINRFull(
                  profit,
                )} net profit. Monthly burn is ${formatINR(monthlyBurn)}.`
              : `You're operating at a loss of ${formatINRFull(
                  Math.abs(profit),
                )}. Monthly burn is ${formatINR(monthlyBurn)}.`
          }
        >
          <div className="grid grid-cols-3 gap-2">
            <InsightStat
              label="Net Profit"
              value={formatINR(profit)}
              tone={isProfitable ? 'text-[#34D399]' : 'text-[#F87171]'}
            />
            <InsightStat label="Monthly Burn" value={formatINR(monthlyBurn)} />
            <InsightStat
              label="Runway"
              value={monthsRemaining !== null ? `${monthsRemaining} mo` : '∞'}
            />
          </div>
        </InsightCard>
      </div>
    </section>
  );
}

function InsightCard({
  icon: Icon,
  tone,
  title,
  summary,
  children,
}: {
  icon: typeof Users;
  tone: string;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-5">
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="gst-card-title text-sm text-foreground">{title}</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{summary}</p>
        </div>
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function InsightStat({
  label,
  value,
  tone = 'text-foreground',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-[#1F1F1F] bg-[#0A0A0A] px-2.5 py-2">
      <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={`text-xs font-semibold ${tone}`}>{value}</span>
    </div>
  );
}

function InsightEmpty({ icon: Icon, text }: { icon: typeof Users; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#1F1F1F] bg-[#0A0A0A] px-3 py-3 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-[#34D399]" />
      {text}
    </div>
  );
}

// ─── Disconnected Hero (premium empty state) ──────────────────────────────────

function DisconnectedHero() {
  const { connect, pending } = useZohoBooks();
  const [error, setError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setError(null);
    const { authUrl, error: err } = await connect();
    if (err) {
      setError(err);
      return;
    }
    if (authUrl) {
      window.location.href = authUrl;
    }
  }, [connect]);

  return (
    <div className="gst-card gst-animate-in">
      <div className="gst-empty-state py-12">
        <div className="gst-empty-state-icon !h-20 !w-20 !rounded-3xl">
          <Plug className="h-9 w-9 text-[#60A5FA]" />
        </div>
        <h3 className="gst-empty-state-title text-xl">Connect Zoho Books</h3>
        <p className="gst-empty-state-desc">
          Authorize GSTPilot to access your Zoho Books organization. We sync customers, invoices,
          bills, payments, and more — then feed the live data into Oracle for AI insights.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Button
            onClick={handleConnect}
            disabled={pending}
            className="gst-btn gst-btn-primary gst-btn-lg"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plug className="h-4 w-4" />
            )}
            Connect Zoho Books
          </Button>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
            OAuth 2.0 · AES-256-GCM encrypted
          </span>
        </div>
        {error ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#EF4444]/25 bg-[#EF4444]/5 px-3 py-2 text-xs text-[#F87171]">
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </div>
        ) : null}

        <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: Users, label: 'Customers & Vendors', desc: 'Sync contact directory' },
            { icon: FileText, label: 'Invoices & Bills', desc: 'AR + AP in one place' },
            { icon: Sparkles, label: 'Oracle Insights', desc: 'AI reads your books' },
          ].map((f) => (
            <div
              key={f.label}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-4 text-center"
            >
              <f.icon className="h-5 w-5 text-[#60A5FA]" />
              <span className="text-xs font-medium text-foreground">{f.label}</span>
              <span className="text-[10px] text-muted-foreground">{f.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Not-connected gate ───────────────────────────────────────────────────────

function NotConnectedGate({ children }: { children: React.ReactNode }) {
  const { status, statusLoading } = useZohoBooks();
  if (statusLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }
  if (!status?.connected) {
    return <DisconnectedHero />;
  }
  return <>{children}</>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ZohoBooksPage() {
  const { organization } = useOrg();

  // Detect ?zoho_connected=1 or ?zoho_error=… from the OAuth callback
  // redirect and surface a one-shot banner.
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
      if (params.get('zoho_connected') || params.get('zoho_error')) {
        const clean = window.location.pathname;
        window.history.replaceState({}, '', clean);
      }
    } catch {
      /* SSR guard */
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="gst-container-wide py-6 md:py-8">
        <div className="flex flex-col gap-8">
          {/* Page title */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="gst-page-title text-foreground">Zoho Books</h1>
              <span className="gst-status gst-status-info">
                <Building2 className="h-3 w-3" /> Accounting Sync Center
              </span>
            </div>
            <p className="gst-description">
              {organization?.name ? `${organization.name} · ` : ''}
              India&apos;s leading accounting platform — connected, synced, and analyzed in one
              premium dashboard.
            </p>
          </div>

          {/* OAuth success/error banner */}
          <AnimatePresence>
            {oauthBanner ? (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                  oauthBanner.ok
                    ? 'border-[#10B981]/25 bg-[#10B981]/5 text-[#34D399]'
                    : 'border-[#EF4444]/25 bg-[#EF4444]/5 text-[#F87171]'
                }`}
              >
                {oauthBanner.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5" />
                )}
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

          {/* 1. Overview header — always visible */}
          <OverviewHeader />

          {/* 2-7. Connected-state sections */}
          <NotConnectedGate>
            <div className="flex flex-col gap-10">
              {/* 2. Sync History Timeline */}
              <SyncHistoryTimeline />

              {/* 3. Accounting Summary */}
              <AccountingSummary />

              {/* 4. Modules Synced */}
              <ModulesSynced />

              {/* 5. Outstanding & Revenue */}
              <OutstandingRevenue />

              {/* 6. Recent Accounting Activity */}
              <RecentActivity />

              {/* 7. Oracle AI Insights */}
              <OracleInsights />
            </div>
          </NotConnectedGate>
        </div>
      </div>
    </div>
  );
}
