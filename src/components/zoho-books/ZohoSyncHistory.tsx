'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — ZohoSyncHistory
// ═══════════════════════════════════════════════════════════════════════════════
//
// Premium vertical-timeline card showing recent Zoho Books sync runs.
//
// RULE 9: The hook currently exposes only the MOST-RECENT sync
// (syncStatus.lastSync). We surface that as a single timeline entry. When the
// hook starts exposing a full history list, this component is already in the
// right shape — just map the entries.
//
// Empty state: "No syncs yet. Click 'Sync Now' to run your first sync." with a
// Sync icon + CTA button.
//
// RULE 7: If the timeline gets long, max-h-96 overflow-y-auto custom-scrollbar.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ZohoSyncStatusInfo } from '@/hooks/useZohoBooks';
import { ZOHO_MODULES, formatTimelineWhen, formatDuration } from './types';

interface ZohoSyncHistoryProps {
  syncStatus: ZohoSyncStatusInfo | null;
  /** True while a sync is currently running (disables the CTA). */
  syncing: boolean;
  /** Fire-and-forget sync trigger. */
  onSyncNow: () => Promise<{ ok: boolean; error: string | null }>;
}

interface TimelineEntry {
  id: string;
  when: string;
  status: 'completed' | 'partial' | 'failed';
  description: string;
  durationLabel: string;
}

function statusBadge(status: TimelineEntry['status']) {
  switch (status) {
    case 'completed':
      return (
        <Badge
          variant="outline"
          className="border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#60A5FA]"
        >
          Completed
        </Badge>
      );
    case 'partial':
      return (
        <Badge
          variant="outline"
          className="border-amber-400/30 bg-amber-400/10 text-amber-400"
        >
          Partial
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
  }
}

function statusIcon(status: TimelineEntry['status']): LucideIcon {
  switch (status) {
    case 'completed':
      return CheckCircle2;
    case 'partial':
      return AlertCircle;
    case 'failed':
      return XCircle;
  }
}

function statusIconColor(status: TimelineEntry['status']): string {
  switch (status) {
    case 'completed':
      return 'text-[#60A5FA]';
    case 'partial':
      return 'text-amber-400';
    case 'failed':
      return 'text-red-400';
  }
}

// Build a single timeline entry from the hook's lastSync.
function buildEntries(syncStatus: ZohoSyncStatusInfo | null): TimelineEntry[] {
  const last = syncStatus?.lastSync;
  if (!last) return [];

  // Compose a description from per-entity stats.
  const parts: string[] = [];
  const stats = last.stats ?? {};
  for (const m of ZOHO_MODULES) {
    const s = stats[m.key];
    if (!s) continue;
    const total = (s.imported ?? 0) + (s.updated ?? 0);
    if (total > 0) {
      parts.push(`${m.label}: ${total} records`);
    }
  }
  const failedTotal = Object.values(stats).reduce(
    (acc, s) => acc + (s?.failed ?? 0),
    0,
  );
  if (failedTotal > 0) parts.push(`${failedTotal} failed`);

  const description =
    parts.length > 0
      ? parts.join(' · ')
      : last.error
        ? last.error
        : 'No records transferred.';

  return [
    {
      id: last.id,
      when: formatTimelineWhen(last.completedAt ?? last.startedAt),
      status:
        last.status === 'completed'
          ? 'completed'
          : last.status === 'partial'
            ? 'partial'
            : 'failed',
      description,
      durationLabel: formatDuration(last.durationMs),
    },
  ];
}

export function ZohoSyncHistory({
  syncStatus,
  syncing,
  onSyncNow,
}: ZohoSyncHistoryProps) {
  const entries = useMemo(() => buildEntries(syncStatus), [syncStatus]);

  return (
    <section
      aria-label="Sync history"
      className="rounded-xl border border-white/[0.06] bg-[#0C0C0C] p-6"
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
            Sync History
          </h2>
        </div>
        {entries.length > 0 ? (
          <button
            type="button"
            onClick={(e) => e.preventDefault()}
            className="text-xs font-medium text-[#60A5FA] transition-colors hover:text-[#93C5FD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
          >
            View all
          </button>
        ) : null}
      </div>

      {entries.length === 0 ? (
        // Empty state
        <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] ring-1 ring-white/[0.06]">
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">
            No syncs yet
          </p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Click &ldquo;Sync Now&rdquo; to run your first sync. We&rsquo;ll
            pull customers, invoices, bills, payments, and more from Zoho Books.
          </p>
          <Button
            size="sm"
            onClick={() => void onSyncNow()}
            disabled={syncing}
            className="mt-4"
          >
            <RefreshCw className={syncing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            {syncing ? 'Syncing…' : 'Run first sync'}
          </Button>
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto custom-scrollbar pr-1">
          <ol className="relative space-y-5 border-l border-white/[0.08] pl-5">
            {entries.map((entry) => {
              const Icon = statusIcon(entry.status);
              return (
                <li key={entry.id} className="relative">
                  {/* Dot */}
                  <span
                    className={`absolute -left-[1.6rem] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-background ring-2 ${
                      entry.status === 'completed'
                        ? 'ring-[#3B82F6]'
                        : entry.status === 'partial'
                          ? 'ring-amber-400'
                          : 'ring-red-400'
                    }`}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Icon
                          className={`h-3.5 w-3.5 ${statusIconColor(entry.status)}`}
                        />
                        <span className="text-xs text-muted-foreground">
                          {entry.when}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-foreground">
                        {entry.description}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Duration: {entry.durationLabel}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {statusBadge(entry.status)}
                      {entry.status === 'failed' || entry.status === 'partial' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 px-2 text-xs text-amber-400 hover:bg-amber-400/10 hover:text-amber-400"
                          onClick={() => void onSyncNow()}
                          disabled={syncing}
                        >
                          <RefreshCw
                            className={syncing ? 'h-3 w-3 animate-spin' : 'h-3 w-3'}
                          />
                          Retry
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}

export default ZohoSyncHistory;
