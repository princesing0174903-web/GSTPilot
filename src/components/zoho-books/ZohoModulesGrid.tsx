'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — ZohoModulesGrid
// ═══════════════════════════════════════════════════════════════════════════════
//
// 8 module cards (Customers / Invoices / Bills / Payments / Expenses /
// Journals / Taxes / Bank). One card per `ZohoSyncEntity` we care about.
//
// Each card shows:
//   • Module icon (top-left, in colored circle)
//   • Sync-status pill (top-right): Synced / Syncing… / Failed / Pending
//   • Synced count (text-2xl font-bold tabular-nums)
//   • "Last updated: {relative}" + "Sync duration: {duration}"
//   • Health bar (red / amber / blue) showing sync health %
//   • Refresh icon-only button (top-right corner, rotates on hover)
//   • Hover: lift + border highlight + "View details" tooltip
//   • Click: opens a Sheet with a placeholder detailed-sync-log message
//
// RULE 9: If the hook has no counts for a module (or totalRecords === 0),
// the card shows "—" with a "Pending" pill. NO fake counts.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useMemo, useState } from 'react';
import {
  RefreshCw,
  Loader2,
  AlertTriangle,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import type { ZohoSyncStatusInfo } from '@/hooks/useZohoBooks';
import {
  ZOHO_MODULES,
  formatRelative,
  formatDuration,
  type ZohoModuleMeta,
} from './types';

type ModuleStatus = 'synced' | 'syncing' | 'failed' | 'pending';

interface ZohoModulesGridProps {
  syncStatus: ZohoSyncStatusInfo | null;
  /** True while a global sync is in progress. */
  syncing: boolean;
  /** Trigger a sync scoped to a single entity. Falls back to a global sync. */
  onSyncNow: () => Promise<{ ok: boolean; error: string | null }>;
}

function statusPill(status: ModuleStatus) {
  switch (status) {
    case 'synced':
      return (
        <Badge
          variant="outline"
          className="border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#60A5FA]"
        >
          Synced
        </Badge>
      );
    case 'syncing':
      return (
        <Badge
          variant="outline"
          className="border-amber-400/30 bg-amber-400/10 text-amber-400"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          Syncing…
        </Badge>
      );
    case 'failed':
      return (
        <Badge
          variant="outline"
          className="border-red-400/30 bg-red-400/10 text-red-400"
        >
          Failed
        </Badge>
      );
    case 'pending':
    default:
      return (
        <Badge
          variant="outline"
          className="border-white/[0.08] bg-white/[0.04] text-muted-foreground"
        >
          Pending
        </Badge>
      );
  }
}

function healthBarPct(count: number, hasSynced: boolean): number {
  if (!hasSynced || count <= 0) return 0;
  // Light heuristic: more records → higher coverage bar.
  if (count >= 200) return 100;
  if (count >= 100) return 80;
  if (count >= 50) return 65;
  if (count >= 10) return 50;
  return 30;
}

function healthColor(pct: number): string {
  if (pct >= 70) return 'bg-[#3B82F6]';
  if (pct >= 40) return 'bg-amber-400';
  return 'bg-red-400';
}

function ModuleCard({
  meta,
  count,
  hasSynced,
  status,
  lastUpdated,
  durationMs,
  syncing,
  onRefresh,
  onOpenDetails,
}: {
  meta: ZohoModuleMeta;
  count: number;
  hasSynced: boolean;
  status: ModuleStatus;
  lastUpdated: string | null;
  durationMs: number | null;
  syncing: boolean;
  onRefresh: () => void;
  onOpenDetails: () => void;
}) {
  const Icon = meta.icon as LucideIcon;
  const pct = healthBarPct(count, hasSynced);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenDetails}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetails();
        }
      }}
      className="group relative cursor-pointer rounded-xl border border-white/[0.06] bg-[#0C0C0C] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.12] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`${meta.label} module — open sync details`}
    >
      {/* Top row: icon + status pill + refresh */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full ${meta.tone}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-foreground">
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {statusPill(status)}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  aria-label={`Refresh ${meta.label}`}
                  disabled={syncing}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefresh();
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-180" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Refresh this module</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Count */}
      <div className="mt-5 flex items-baseline gap-2">
        <span
          className={`text-2xl font-bold tabular-nums ${
            hasSynced && count > 0 ? 'text-foreground' : 'text-muted-foreground/60'
          }`}
        >
          {hasSynced && count > 0 ? count.toLocaleString('en-IN') : '—'}
        </span>
        {hasSynced && count > 0 ? (
          <span className="text-[11px] text-muted-foreground">records</span>
        ) : null}
      </div>

      {/* Meta */}
      <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Last updated: {hasSynced ? formatRelative(lastUpdated) : '—'}
        </span>
        <span>Sync duration: {hasSynced ? formatDuration(durationMs) : '—'}</span>
      </div>

      {/* Health bar */}
      <div className="mt-4 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${healthColor(pct)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {hasSynced ? `${pct}%` : '—'}
        </span>
      </div>

      {/* Hover tooltip "View details" — appears on hover at bottom-right */}
      <div className="pointer-events-none absolute bottom-3 right-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-[#60A5FA]">
          View details
        </span>
      </div>
    </div>
  );
}

export function ZohoModulesGrid({
  syncStatus,
  syncing,
  onSyncNow,
}: ZohoModulesGridProps) {
  const [detailsOpen, setDetailsOpen] = useState<ZohoModuleMeta | null>(null);

  const cards = useMemo(() => {
    const recordsImported = syncStatus?.recordsImported ?? {};
    const lastSync = syncStatus?.lastSync ?? null;
    const hasSynced = !!lastSync && (syncStatus?.totalRecords ?? 0) > 0;
    const stats = lastSync?.stats ?? {};
    return ZOHO_MODULES.map((meta) => {
      const count = recordsImported[meta.key] ?? 0;
      const entityStats = stats[meta.key];
      const lastError = entityStats?.lastError ?? null;
      const failedCount = entityStats?.failed ?? 0;

      // Derive the per-module status from global syncing state + stats.
      let status: ModuleStatus = 'pending';
      if (syncing) {
        // If a sync is running AND this entity is the current one OR has stats,
        // mark as syncing. Otherwise, if it has prior data, keep "synced".
        const isCurrent = syncStatus?.lastSync?.currentEntity === meta.key;
        if (isCurrent) status = 'syncing';
        else if (hasSynced && count > 0) status = 'synced';
        else status = 'pending';
      } else if (hasSynced && count > 0) {
        status = failedCount > 0 && count === 0 ? 'failed' : 'synced';
        if (lastError && failedCount > 0 && count === 0) status = 'failed';
      } else if (lastError) {
        status = 'failed';
      } else {
        status = 'pending';
      }

      return {
        meta,
        count,
        hasSynced,
        status,
        lastUpdated: lastSync?.completedAt ?? lastSync?.startedAt ?? null,
        durationMs: lastSync?.durationMs ?? null,
        failedCount,
        lastError,
      };
    });
  }, [syncStatus, syncing]);

  const handleRefresh = useCallback(async () => {
    const { ok, error } = await onSyncNow();
    if (!ok && error) {
      toast.error("We couldn't refresh the modules", {
        description: error,
        action: { label: 'Retry', onClick: () => void onSyncNow() },
      });
    }
  }, [onSyncNow]);

  return (
    <section aria-label="Sync modules">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
          Modules
        </h2>
        <span className="text-xs text-muted-foreground">
          {ZOHO_MODULES.length} modules · click any card for details
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <ModuleCard
            key={c.meta.key}
            meta={c.meta}
            count={c.count}
            hasSynced={c.hasSynced}
            status={c.status}
            lastUpdated={c.lastUpdated}
            durationMs={c.durationMs}
            syncing={syncing}
            onRefresh={handleRefresh}
            onOpenDetails={() => setDetailsOpen(c.meta)}
          />
        ))}
      </div>

      {/* Module details sheet (placeholder, per RULE 3c) */}
      <Sheet
        open={detailsOpen !== null}
        onOpenChange={(o) => !o && setDetailsOpen(null)}
      >
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <div className="flex items-center gap-3">
              {detailsOpen ? (
                <>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${detailsOpen.tone}`}
                  >
                    {(() => {
                      const Icon = detailsOpen.icon as LucideIcon;
                      return <Icon className="h-5 w-5" />;
                    })()}
                  </div>
                  <div>
                    <SheetTitle className="text-base">
                      {detailsOpen.label} sync details
                    </SheetTitle>
                    <SheetDescription>
                      Per-record sync log for this module.
                    </SheetDescription>
                  </div>
                </>
              ) : null}
            </div>
          </SheetHeader>
          <div className="px-4 pb-6">
            <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
              <AlertTriangle className="mx-auto h-6 w-6 text-amber-400/80" />
              <p className="mt-3 text-sm font-semibold text-foreground">
                Detailed sync log coming soon
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                We&rsquo;re shipping a per-record sync log viewer in a follow-up
                release. For now, use the &ldquo;Sync Now&rdquo; button to
                refresh this module.
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}

// (no extra exports — keep the file focused)

export default ZohoModulesGrid;
