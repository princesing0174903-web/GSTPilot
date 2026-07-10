'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// FinancePage — Obsidian Infinity™ "Connect Your Business Data" hub
//
// Premium glassmorphism integrations page. Groups 20 connectors across 7
// categories, surfaces the Sync Engine™ status, exposes per-card Sync Now /
// Connect / Disconnect actions, and shows a prominent empty-state when no
// connectors are connected yet.
//
// All data flows from /api/integrations (catalog, connected state, lastSyncAt).
// The Sync Engine™ bar additionally reads /api/integrations/events to surface
// the most recent full sync. NO fake demo data.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  ShieldCheck,
  Landmark,
  Mail,
  HardDrive,
  MessageCircle,
  CreditCard,
  Calculator,
  FileSpreadsheet,
  Users,
  Plug,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  Loader2,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Integration {
  id: string;
  firmId: string | null;
  key: string;
  name: string;
  category: string;
  connected: boolean;
  lastSyncAt: string | null;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

interface SyncEvent {
  id: string;
  type: string;
  source: string | null;
  title: string | null;
  severity: string | null;
  createdAt: string;
}

// ─── Icon mapping (API returns a string name; UI owns the component) ──────────
// Declared at module scope so we don't create a component during render.

const ICON_MAP: Record<string, LucideIcon> = {
  ShieldCheck,
  Landmark,
  Mail,
  HardDrive,
  MessageCircle,
  CreditCard,
  Calculator,
  FileSpreadsheet,
  Users,
};

function IntegrationIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICON_MAP[name] ?? Plug;
  return <Icon className={className} />;
}

// ─── Category metadata ─────────────────────────────────────────────────────────
// Drives section ordering + labels. The `key` matches the `category` field
// returned by /api/integrations.

const CATEGORY_ORDER = [
  'government',
  'banking',
  'communication',
  'storage',
  'payment',
  'accounting',
  'business',
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  government: 'Government',
  banking: 'Banking',
  communication: 'Communication',
  storage: 'Storage',
  payment: 'Payments',
  accounting: 'Accounting',
  business: 'Business Systems',
};

// ─── Connector metadata (presentation layer) ──────────────────────────────────
// Each connector exposes a fixed set of permission scopes and collection
// streams. These describe WHAT the connector pulls in (not real-time business
// data — that lives in the events feed). Same shape as the `icon` field: a
// static catalogue annotation the UI owns.

interface ConnectorMeta {
  permissions: string[];
  collections: string[];
}

const CONNECTOR_META: Record<string, ConnectorMeta> = {
  gstn: { permissions: ['Read only'], collections: ['gstReturns', 'gstNotices'] },
  hdfc: { permissions: ['Read only'], collections: ['transactions', 'statements'] },
  icici: { permissions: ['Read only'], collections: ['transactions', 'statements'] },
  sbi: { permissions: ['Read only'], collections: ['transactions', 'statements'] },
  axis: { permissions: ['Read only'], collections: ['transactions', 'statements'] },
  kotak: { permissions: ['Read only'], collections: ['transactions', 'statements'] },
  indusind: { permissions: ['Read only'], collections: ['transactions', 'statements'] },
  gmail: { permissions: ['Read only'], collections: ['invoices', 'notices'] },
  outlook: { permissions: ['Read only'], collections: ['invoices', 'notices'] },
  whatsapp: { permissions: ['Send & Receive'], collections: ['messages', 'reminders'] },
  drive: { permissions: ['Read only'], collections: ['documents', 'invoices'] },
  excel: { permissions: ['Read only'], collections: ['rows', 'sheets'] },
  razorpay: { permissions: ['Read only'], collections: ['payments', 'payouts'] },
  cashfree: { permissions: ['Read only'], collections: ['payments', 'payouts'] },
  payu: { permissions: ['Read only'], collections: ['payments', 'payouts'] },
  stripe: { permissions: ['Read only'], collections: ['payments', 'payouts'] },
  tally: { permissions: ['Read & Write'], collections: ['invoices', 'ledger'] },
  zoho_books: { permissions: ['Read & Write'], collections: ['invoices', 'ledger'] },
  quickbooks: { permissions: ['Read & Write'], collections: ['invoices', 'ledger'] },
  clients: { permissions: ['Read only'], collections: ['clients', 'contacts'] },
};

function getMeta(key: string): ConnectorMeta {
  return CONNECTOR_META[key] ?? { permissions: ['Read only'], collections: ['data'] };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: string | null | undefined): string {
  if (!date) return 'Never';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'Never';
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function groupByCategory(items: Integration[]): Array<{
  category: string;
  label: string;
  items: Integration[];
}> {
  const out: Array<{ category: string; label: string; items: Integration[] }> = [];
  for (const cat of CATEGORY_ORDER) {
    const groupItems = items.filter((i) => i.category === cat);
    if (groupItems.length === 0) continue;
    out.push({ category: cat, label: CATEGORY_LABELS[cat] ?? cat, items: groupItems });
  }
  // Surface any unexpected categories at the end (defensive — never crash).
  for (const item of items) {
    if (!CATEGORY_ORDER.includes(item.category as (typeof CATEGORY_ORDER)[number])) {
      const cat = item.category;
      let bucket = out.find((o) => o.category === cat);
      if (!bucket) {
        bucket = { category: cat, label: CATEGORY_LABELS[cat] ?? cat, items: [] };
        out.push(bucket);
      }
      if (!bucket.items.includes(item)) bucket.items.push(item);
    }
  }
  return out;
}

// ─── Motion presets (≤250ms per the design system) ───────────────────────────

const EASE = [0.4, 0, 0.2, 1] as const;

const FADE_UP = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: EASE },
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export function FinancePage() {
  const { toast } = useToast();

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [syncingKey, setSyncingKey] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [bulkConnecting, setBulkConnecting] = useState(false);

  // ── Sync Engine™ status: most recent sync_completed event ──
  const [lastFullSync, setLastFullSync] = useState<string | null>(null);

  // ── Initial load ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch('/api/integrations', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('fetch failed');
        return r.json();
      })
      .then((data: { integrations?: Integration[] }) => {
        if (cancelled) return;
        setIntegrations(data.integrations ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Fetch the most recent sync_completed event for the Sync Engine bar ──
  const refreshLastSync = useCallback(() => {
    fetch(
      '/api/integrations/events?type=sync_completed&limit=1',
      { cache: 'no-store' },
    )
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data: { events?: SyncEvent[] } | null) => {
        if (!data?.events || data.events.length === 0) return;
        setLastFullSync(data.events[0].createdAt);
      })
      .catch(() => {
        /* silent — bar still renders with "Never" */
      });
  }, []);

  useEffect(() => {
    refreshLastSync();
  }, [refreshLastSync]);

  // ── Silent refetch after a toggle (no skeleton flicker) ──
  const refetch = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/integrations', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { integrations?: Integration[] };
      setIntegrations(data.integrations ?? []);
    } catch {
      /* silent — optimistic state already reflects intent */
    }
  }, []);

  // ── Connect / disconnect handler: optimistic → POST → refetch → toast ──
  const handleToggle = useCallback(
    async (
      integration: Integration,
      action: 'connect' | 'disconnect',
    ): Promise<void> => {
      if (pendingKey) return;
      setPendingKey(integration.key);
      const snapshot = integrations;

      setIntegrations((prev) =>
        prev.map((i) =>
          i.key === integration.key
            ? {
                ...i,
                connected: action === 'connect',
                lastSyncAt:
                  action === 'connect' ? new Date().toISOString() : null,
              }
            : i,
        ),
      );

      try {
        const res = await fetch('/api/integrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: integration.key, action }),
        });
        if (!res.ok) throw new Error('toggle failed');
        await refetch();
        toast({
          title: action === 'connect' ? 'Connected' : 'Disconnected',
          description:
            action === 'connect'
              ? `${integration.name} is now active.`
              : `${integration.name} was disconnected.`,
        });
      } catch {
        setIntegrations(snapshot);
        toast({
          variant: 'destructive',
          title: 'Something went wrong',
          description: `Could not ${action} ${integration.name}. Please try again.`,
        });
      } finally {
        setPendingKey(null);
      }
    },
    [integrations, pendingKey, refetch, toast],
  );

  // ── Sync-now handler (per-card) ──
  const handleSync = useCallback(
    async (integration: Integration): Promise<void> => {
      if (syncingKey) return;
      setSyncingKey(integration.key);
      try {
        const res = await fetch('/api/integrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: integration.key, action: 'sync' }),
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          if (data?.requiresConfiguration) {
            toast({
              variant: 'destructive',
              title: 'Configuration required',
              description:
                data?.error ??
                `${integration.name} needs credentials before it can sync.`,
            });
          } else {
            throw new Error(data?.error ?? 'sync failed');
          }
          return;
        }

        // Refresh the last-sync timestamp on the card
        await refetch();
        refreshLastSync();

        const pulled = data?.syncJob?.recordsPulled;
        toast({
          title: 'Sync complete',
          description:
            typeof pulled === 'number'
              ? `${integration.name}: ${pulled} record${pulled === 1 ? '' : 's'} pulled.`
              : `${integration.name} synced successfully.`,
        });
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Sync failed',
          description:
            err instanceof Error
              ? err.message
              : `Could not sync ${integration.name}. Please try again.`,
        });
      } finally {
        setSyncingKey(null);
      }
    },
    [refreshLastSync, refetch, syncingKey, toast],
  );

  // ── Sync-all handler (Sync Engine bar) ──
  const handleSyncAll = useCallback(async (): Promise<void> => {
    if (syncingAll) return;
    setSyncingAll(true);
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-all' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'sync-all failed');

      await refetch();
      refreshLastSync();

      const r = data?.syncAll;
      if (r && typeof r === 'object') {
        const parts: string[] = [];
        if (typeof r.succeeded === 'number') parts.push(`${r.succeeded} succeeded`);
        if (typeof r.failed === 'number' && r.failed > 0) parts.push(`${r.failed} failed`);
        if (typeof r.skipped === 'number' && r.skipped > 0) parts.push(`${r.skipped} skipped`);
        toast({
          title: 'Sync Engine complete',
          description: parts.length ? parts.join(' · ') : 'All connectors synced.',
        });
      } else {
        toast({ title: 'Sync complete', description: 'Sync Engine ran successfully.' });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Sync Engine failed',
        description:
          err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setSyncingAll(false);
    }
  }, [refreshLastSync, refetch, syncingAll, toast]);

  // ── "Connect My Business" — empty-state bulk connect ──
  const handleConnectBusiness = useCallback(async (): Promise<void> => {
    if (bulkConnecting) return;
    setBulkConnecting(true);
    const targets = ['gstn', 'hdfc', 'gmail'];
    let succeeded = 0;
    let failed = 0;

    // Optimistic flip first so cards light up immediately.
    setIntegrations((prev) =>
      prev.map((i) =>
        targets.includes(i.key)
          ? { ...i, connected: true, lastSyncAt: new Date().toISOString() }
          : i,
      ),
    );

    for (const key of targets) {
      const integration = integrations.find((i) => i.key === key);
      if (!integration) continue;
      try {
        const res = await fetch('/api/integrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, action: 'connect' }),
        });
        if (!res.ok) throw new Error('connect failed');
        succeeded += 1;
      } catch {
        failed += 1;
      }
    }

    await refetch();
    setBulkConnecting(false);

    toast({
      title: failed === 0 ? 'Business connected' : 'Partially connected',
      description:
        failed === 0
          ? `GSTN, HDFC Bank, and Gmail are now active. Oracle has a live view of your business.`
          : `${succeeded} of ${targets.length} connected. ${failed} failed — try again from the cards.`,
    });
  }, [bulkConnecting, integrations, refetch, toast]);

  // ── Derived counts ──
  const totalCount = integrations.length;
  const connectedCount = integrations.filter((i) => i.connected).length;
  const percent =
    totalCount > 0 ? Math.round((connectedCount / totalCount) * 100) : 0;
  const grouped = groupByCategory(integrations);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-full w-full px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-[1200px]">
        {/* ─── Header ─── */}
        <motion.div {...FADE_UP}>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="size-3.5" />
            <span className="text-[11px] font-medium uppercase tracking-[0.18em]">
              Finance
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-[40px]">
            Connect Your Business Data
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground md:text-[15px]">
            Connect your financial stack. Oracle becomes smarter with every
            connection.
          </p>
        </motion.div>

        {/* ─── Sync Engine™ status bar ─── */}
        <motion.div
          {...FADE_UP}
          transition={{ ...FADE_UP.transition, delay: 0.04 }}
          className="mt-7"
        >
          <SyncEngineBar
            lastFullSync={lastFullSync}
            syncingAll={syncingAll}
            onSyncAll={handleSyncAll}
          />
        </motion.div>

        {/* ─── Summary strip ─── */}
        <motion.div
          {...FADE_UP}
          transition={{ ...FADE_UP.transition, delay: 0.08 }}
          className="mt-4"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              <span className="font-semibold accent-text">{connectedCount}</span>
              <span className="text-muted-foreground">
                {' '}
                of {totalCount || 20} connected
              </span>
            </span>
            <span className="tabular-nums text-muted-foreground">{percent}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="accent-gradient h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.4, ease: EASE }}
            />
          </div>
        </motion.div>

        {/* ─── Body: loading / error / content ─── */}
        {loading ? (
          <SkeletonGrid />
        ) : error ? (
          <ErrorState onRetry={() => window.location.reload()} />
        ) : (
          <>
            {/* ─── Empty state (only when nothing is connected) ─── */}
            {connectedCount === 0 && (
              <motion.div
                {...FADE_UP}
                transition={{ ...FADE_UP.transition, delay: 0.1 }}
                className="mt-6"
              >
                <EmptyState
                  onConnect={handleConnectBusiness}
                  pending={bulkConnecting}
                />
              </motion.div>
            )}

            {/* ─── Category sections ─── */}
            <div className="mt-8 space-y-10">
              {grouped.map((group, gi) => {
                const connected = group.items.filter((i) => i.connected).length;
                return (
                  <motion.section
                    key={group.category}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.22,
                      delay: 0.1 + gi * 0.04,
                      ease: EASE,
                    }}
                    aria-labelledby={`cat-${group.category}`}
                  >
                    <CategoryHeader
                      label={group.label}
                      connected={connected}
                      total={group.items.length}
                    />
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {group.items.map((integration, idx) => (
                        <motion.div
                          key={integration.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.2,
                            delay: idx * 0.025,
                            ease: EASE,
                          }}
                        >
                          <ConnectorCard
                            integration={integration}
                            pending={pendingKey === integration.key}
                            syncing={syncingKey === integration.key}
                            onConnect={() =>
                              handleToggle(integration, 'connect')
                            }
                            onDisconnect={() =>
                              handleToggle(integration, 'disconnect')
                            }
                            onSync={() => handleSync(integration)}
                          />
                        </motion.div>
                      ))}
                    </div>
                  </motion.section>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

// ─── SyncEngineBar ─────────────────────────────────────────────────────────────

interface SyncEngineBarProps {
  lastFullSync: string | null;
  syncingAll: boolean;
  onSyncAll: () => void;
}

function SyncEngineBar({
  lastFullSync,
  syncingAll,
  onSyncAll,
}: SyncEngineBarProps) {
  return (
    <div
      className={cn(
        'glass-surface flex flex-col gap-3 rounded-2xl border border-white/[0.08] p-4',
        'sm:flex-row sm:items-center sm:justify-between sm:p-5',
      )}
    >
      <div className="flex items-center gap-3">
        {/* Pulsing emerald dot */}
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00F5D4] opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-[#00F5D4]" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              Sync Engine
            </span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Live
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Last full sync:{' '}
            <span className="text-muted-foreground/80">
              {lastFullSync ? timeAgo(lastFullSync) : 'Never'}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSyncAll}
        disabled={syncingAll}
        className={cn(
          'accent-gradient inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-4',
          'text-xs font-semibold text-black',
          'transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99]',
          'disabled:cursor-not-allowed disabled:opacity-70',
        )}
      >
        {syncingAll ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Syncing all…
          </>
        ) : (
          <>
            <RefreshCw className="size-3.5" />
            Sync All
          </>
        )}
      </button>
    </div>
  );
}

// ─── CategoryHeader ────────────────────────────────────────────────────────────

function CategoryHeader({
  label,
  connected,
  total,
}: {
  label: string;
  connected: number;
  total: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2
        id={`cat-${label.toLowerCase().replace(/\s+/g, '-')}`}
        className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
      >
        {label}
      </h2>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
        <span className="tabular-nums">
          <span className="text-[#00F5D4]">{connected}</span>
          <span className="text-muted-foreground/60">/{total}</span>
        </span>
        <span className="h-px w-8 bg-gradient-to-r from-white/[0.14] to-transparent" />
      </div>
    </div>
  );
}

// ─── EmptyState ────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  onConnect: () => void;
  pending: boolean;
}

function EmptyState({ onConnect, pending }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'glass-surface relative overflow-hidden rounded-[28px] border border-white/[0.08] p-8 md:p-12',
      )}
    >
      {/* Soft aurora glow behind the empty state */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(0,245,212,0.35) 0%, rgba(0,184,255,0.12) 50%, transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-16 size-60 rounded-full opacity-20 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(6,182,212,0.30) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <Sparkles className="size-3 text-[#00F5D4]" />
          Get started
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-[28px] md:leading-tight">
          Oracle becomes powerful when your business data is connected.
        </h2>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground md:text-[15px]">
          Connect GSTN, your bank, and Gmail to give Oracle a live view of your
          business.
        </p>

        <button
          type="button"
          onClick={onConnect}
          disabled={pending}
          className={cn(
            'accent-gradient mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5',
            'text-sm font-semibold text-black',
            'transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99]',
            'disabled:cursor-not-allowed disabled:opacity-70',
          )}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Connecting…
            </>
          ) : (
            <>
              Connect My Business
              <ArrowRight className="size-4" />
            </>
          )}
        </button>

        <div className="mt-6 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {['GSTN', 'HDFC Bank', 'Gmail'].map((n) => (
            <span
              key={n}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1"
            >
              <span className="size-1 rounded-full bg-[#00F5D4]/70" />
              {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ConnectorCard ─────────────────────────────────────────────────────────────

interface ConnectorCardProps {
  integration: Integration;
  pending: boolean;
  syncing: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => void;
}

function ConnectorCard({
  integration,
  pending,
  syncing,
  onConnect,
  onDisconnect,
  onSync,
}: ConnectorCardProps) {
  const { connected, name, category, lastSyncAt, icon, key } = integration;
  const meta = getMeta(key);
  const firstPermission = meta.permissions[0] ?? 'Read only';
  const firstCollections = meta.collections.slice(0, 2).join(', ');

  return (
    <div
      className={cn(
        'glass-surface group relative flex h-full flex-col overflow-hidden rounded-2xl p-4',
        'border border-white/[0.08] transition-all duration-200',
        'hover:border-white/[0.16] hover:bg-white/[0.05]',
      )}
    >
      {/* Subtle accent sheen on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-px h-px opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(0,245,212,0.4), transparent)',
        }}
      />

      {/* ── Top row: icon + name + category + status pill ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              'accent-gradient-soft flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08]',
              'transition-transform duration-200 group-hover:scale-[1.04]',
            )}
          >
            <IntegrationIcon name={icon} className="size-[18px] text-[#00F5D4]" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">
              {name}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {CATEGORY_LABELS[category] ?? category}
            </div>
          </div>
        </div>

        {connected ? (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1',
              'border-[#00F5D4]/30 bg-[#00F5D4]/10 text-[11px] font-medium text-[#00F5D4]',
            )}
            style={{ boxShadow: '0 0 16px -4px rgba(0, 245, 212, 0.35)' }}
          >
            <span className="size-1.5 rounded-full bg-[#00F5D4]" />
            Connected
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            Not connected
          </span>
        )}
      </div>

      {/* ── Middle: last sync, permissions, collections ── */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="text-muted-foreground/60">Last sync:</span>
          <span className="text-muted-foreground/90">
            {connected ? timeAgo(lastSyncAt) : 'Never'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="text-muted-foreground/60">Permissions:</span>
          <span className="text-muted-foreground/90">{firstPermission}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="text-muted-foreground/60">Collections:</span>
          <span className="truncate text-muted-foreground/90">
            {firstCollections}
          </span>
        </div>
      </div>

      {/* ── Bottom: actions ── */}
      <div className="mt-auto flex items-center gap-2 pt-4">
        {connected ? (
          <>
            <button
              type="button"
              onClick={onSync}
              disabled={pending || syncing}
              className={cn(
                'accent-gradient inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg',
                'px-3 text-xs font-semibold text-black',
                'transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]',
                'disabled:cursor-not-allowed disabled:opacity-70',
              )}
            >
              {syncing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Sync Now
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              disabled={pending || syncing}
              className={cn(
                'inline-flex h-9 items-center justify-center rounded-lg px-2.5',
                'text-[11px] font-medium text-muted-foreground',
                'transition-colors duration-200 hover:text-foreground',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            disabled={pending}
            className={cn(
              'accent-gradient inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg',
              'px-3 text-xs font-semibold text-black',
              'transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]',
              'disabled:cursor-not-allowed disabled:opacity-70',
            )}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <>
                Connect
                <ArrowRight className="size-3.5" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── SkeletonGrid (loading state) ──────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div className="mt-8 space-y-10">
      {Array.from({ length: 3 }).map((_, si) => (
        <div key={si}>
          <div className="flex items-center justify-between">
            <div className="h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-2 w-10 animate-pulse rounded bg-white/[0.04]" />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="glass-surface animate-pulse rounded-2xl border border-white/[0.06] p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 shrink-0 rounded-xl bg-white/[0.06]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 rounded bg-white/[0.06]" />
                    <div className="h-2 w-14 rounded bg-white/[0.04]" />
                  </div>
                  <div className="h-5 w-20 rounded-full bg-white/[0.06]" />
                </div>
                <div className="mt-4 space-y-1.5">
                  <div className="h-2 w-28 rounded bg-white/[0.04]" />
                  <div className="h-2 w-24 rounded bg-white/[0.04]" />
                  <div className="h-2 w-32 rounded bg-white/[0.04]" />
                </div>
                <div className="mt-4 h-9 w-full rounded-lg bg-white/[0.06]" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ErrorState ────────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="glass-surface mt-8 flex flex-col items-center justify-center rounded-[28px] border border-white/[0.08] px-6 py-14 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-white/[0.04]">
        <AlertCircle className="size-5 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">
        Couldn&apos;t load integrations.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Please retry.</p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          'accent-gradient mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-4',
          'text-xs font-semibold text-black',
          'transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99]',
        )}
      >
        <RefreshCw className="size-3.5" />
        Retry
      </button>
    </div>
  );
}

export default FinancePage;
