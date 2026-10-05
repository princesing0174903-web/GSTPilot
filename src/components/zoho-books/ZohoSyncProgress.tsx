'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — ZohoSyncProgress
// ═══════════════════════════════════════════════════════════════════════════════
//
// Two premium strips shown above the modules grid:
//
//   (1) LIVE PROGRESS STRIP — shown while `syncing === true`.
//       Displays "Fetching {currentEntity}…" with an elapsed timer and a
//       per-module mini-track (X of N entities processed).
//
//   (2) PARTIAL-SYNC WARNING — shown when the most-recent sync completed
//       with `status === 'partial'`. Lists which modules failed with their
//       underlying error messages, plus a one-click "Retry sync" CTA.
//
// RULE 9 (no fake numbers): every value comes from `syncStatus.lastSync`
// (real Zoho sync data). If `currentEntity` is null, we show "Preparing…"
// rather than a fake module name.
//
// RULE 5 (no raw errors): per-module errors are surfaced verbatim from the
// sync engine (they're already user-safe — Zoho returns human-readable
// messages like "Invalid country code"), but we cap the length to keep the
// UI tidy.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { Loader2, AlertTriangle, RotateCcw, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ZohoSyncStatusInfo, ZohoSyncEntity } from '@/hooks/useZohoBooks';
import { ZOHO_MODULES, formatDuration } from './types';

const ENTITY_LABELS: Record<ZohoSyncEntity, string> = {
  customer: 'Customers',
  vendor: 'Vendors',
  tax: 'Taxes',
  bank_account: 'Bank Accounts',
  invoice: 'Invoices',
  bill: 'Bills',
  expense: 'Expenses',
  bank_transaction: 'Bank Transactions',
  journal: 'Journals',
  payment: 'Payments',
  item: 'Items',
  creditnote: 'Credit Notes',
};

function formatElapsed(ms: number | null | undefined): string {
  if (!ms || ms < 0) return '0s';
  return formatDuration(ms);
}

// ─── (1) Live progress strip ──────────────────────────────────────────────────

function LiveProgressStrip({
  syncStatus,
  elapsedMs,
}: {
  syncStatus: ZohoSyncStatusInfo;
  elapsedMs: number;
}) {
  const lastSync = syncStatus.lastSync;
  const currentEntity = lastSync?.currentEntity;
  const currentLabel = currentEntity
    ? ENTITY_LABELS[currentEntity] ?? currentEntity
    : 'Preparing';

  // Per-module mini track: ✓ done, ◐ current, ○ pending.
  const moduleStates = useMemo(() => {
    const stats = lastSync?.stats ?? {};
    return ZOHO_MODULES.map((m) => {
      const s = stats[m.key];
      const isCurrent = currentEntity === m.key;
      const hasImported = (s?.imported ?? 0) > 0 || (s?.updated ?? 0) > 0;
      const hasFailed = (s?.failed ?? 0) > 0;
      let state: 'done' | 'current' | 'failed' | 'pending' = 'pending';
      if (isCurrent) state = 'current';
      else if (hasFailed && !hasImported) state = 'failed';
      else if (hasImported || s) state = 'done';
      return { key: m.key, label: ENTITY_LABELS[m.key] ?? m.key, state };
    });
  }, [lastSync, currentEntity]);

  const doneCount = moduleStates.filter((m) => m.state === 'done' || m.state === 'failed').length;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Zoho Books sync in progress"
      className="rounded-xl border border-[#3B82F6]/25 bg-[#3B82F6]/[0.06] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-[#60A5FA]" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Syncing Zoho Books
            </p>
            <p className="text-xs text-muted-foreground">
              Fetching {currentLabel}… {formatElapsed(elapsedMs)} elapsed ·{' '}
              {doneCount}/{moduleStates.length} modules processed
            </p>
          </div>
        </div>
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#60A5FA]">
          Live
        </span>
      </div>

      {/* Per-module mini track */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {moduleStates.map((m) => {
          const cls =
            m.state === 'done'
              ? 'border-[#3B82F6]/40 bg-[#3B82F6]/15 text-[#60A5FA]'
              : m.state === 'current'
                ? 'border-amber-400/40 bg-amber-400/15 text-amber-300'
                : m.state === 'failed'
                  ? 'border-red-400/40 bg-red-400/15 text-red-300'
                  : 'border-white/[0.06] bg-white/[0.02] text-muted-foreground';
          return (
            <span
              key={m.key}
              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}
            >
              {m.state === 'done' ? (
                <CheckCircle2 className="h-2.5 w-2.5" />
              ) : m.state === 'current' ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              ) : m.state === 'failed' ? (
                <XCircle className="h-2.5 w-2.5" />
              ) : null}
              {m.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── (2) Partial-sync warning strip ───────────────────────────────────────────

function PartialSyncWarning({
  syncStatus,
  onRetry,
}: {
  syncStatus: ZohoSyncStatusInfo;
  onRetry: () => void;
}) {
  const lastSync = syncStatus.lastSync;
  if (!lastSync || lastSync.status !== 'partial') return null;

  const stats = lastSync.stats ?? {};
  const failedModules = ZOHO_MODULES.filter((m) => {
    const s = stats[m.key];
    return s && (s.failed ?? 0) > 0;
  }).map((m) => ({
    key: m.key,
    label: ENTITY_LABELS[m.key] ?? m.key,
    failed: stats[m.key]?.failed ?? 0,
    error: stats[m.key]?.lastError,
  }));

  if (failedModules.length === 0) return null;

  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-400/30 bg-amber-400/[0.08] p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-200">
              Last sync was partial — {failedModules.length} module
              {failedModules.length === 1 ? '' : 's'} failed
            </p>
            <p className="mt-0.5 text-xs text-amber-200/70">
              Other modules synced successfully. You can retry the failed
              modules now or continue with the partial data.
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {failedModules.map((m) => (
                <li
                  key={m.key}
                  className="flex flex-wrap items-center gap-2 text-xs text-amber-100/90"
                >
                  <span className="font-medium">{m.label}</span>
                  <span className="text-amber-200/50">·</span>
                  <span>
                    {m.failed} record{m.failed === 1 ? '' : 's'} failed
                  </span>
                  {m.error ? (
                    <>
                      <span className="text-amber-200/50">·</span>
                      <span className="truncate text-amber-200/70">
                        {m.error.slice(0, 180)}
                        {m.error.length > 180 ? '…' : ''}
                      </span>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          className="shrink-0 gap-1.5 border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20 hover:text-amber-100"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Retry sync
        </Button>
      </div>
    </div>
  );
}

// ─── Exported composite ───────────────────────────────────────────────────────

interface ZohoSyncProgressProps {
  syncStatus: ZohoSyncStatusInfo | null;
  syncing: boolean;
  onRetry: () => Promise<{ ok: boolean; error: string | null }>;
}

export function ZohoSyncProgress({
  syncStatus,
  syncing,
  onRetry,
}: ZohoSyncProgressProps) {
  // Compute elapsed time from lastSync.startedAt (when running).
  const elapsedMs = useMemo(() => {
    if (!syncing || !syncStatus?.lastSync?.startedAt) return 0;
    const start = new Date(syncStatus.lastSync.startedAt).getTime();
    if (isNaN(start)) return 0;
    return Date.now() - start;
  }, [syncing, syncStatus?.lastSync?.startedAt]);

  if (syncing && syncStatus?.lastSync) {
    return (
      <LiveProgressStrip syncStatus={syncStatus} elapsedMs={elapsedMs} />
    );
  }

  if (syncStatus?.lastSync?.status === 'partial') {
    return <PartialSyncWarning syncStatus={syncStatus} onRetry={() => void onRetry()} />;
  }

  return null;
}

export default ZohoSyncProgress;
