'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — ZohoConnected
// ═══════════════════════════════════════════════════════════════════════════════
//
// The connected-mode dashboard shell. Composes (top → bottom):
//   (a) ZohoHeader — sticky glass connection bar
//   (b) ZohoKpiRow — 4 KPI cards (or "— Awaiting first sync")
//   (c) ZohoModulesGrid — 8 module cards
//   (d) ZohoSyncHistory — vertical timeline (or empty-state CTA)
//   (e) ZohoOracleInsights — STATIC insight cards (HIDDEN until first sync)
//   (f) ZohoLatestRecords — 3-tab table (HIDDEN until first sync)
//
// RULE 1: ONE SOURCE OF TRUTH — `status.connected === true` ⇒ render this.
// RULE 3: If no sync has happened yet, KPIs show "—", modules show "Pending",
//   history shows empty state, and insights + latest records are HIDDEN.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback } from 'react';
import { toast } from 'sonner';
import type {
  ZohoConnectionStatus,
  ZohoSyncStatusInfo,
} from '@/hooks/useZohoBooks';
import { ZohoHeader } from './ZohoHeader';
import { ZohoKpiRow } from './ZohoKpiRow';
import { ZohoModulesGrid } from './ZohoModulesGrid';
import { ZohoSyncHistory } from './ZohoSyncHistory';
import { ZohoOracleInsights } from './ZohoOracleInsights';
import { ZohoLatestRecords } from './ZohoLatestRecords';

interface ZohoConnectedProps {
  status: ZohoConnectionStatus;
  syncStatus: ZohoSyncStatusInfo | null;
  syncing: boolean;
  pending: boolean;
  /** Trigger a manual sync. */
  onSyncNow: () => Promise<{ ok: boolean; error: string | null }>;
  /** Refresh the access token. */
  onRefreshToken: () => Promise<{ error: string | null }>;
  /** Disconnect the integration. */
  onDisconnect: () => Promise<{ error: string | null }>;
}

export function ZohoConnected({
  status,
  syncStatus,
  syncing,
  pending,
  onSyncNow,
  onRefreshToken,
  onDisconnect,
}: ZohoConnectedProps) {
  // Derive the relevant timestamps from the connection + sync state.
  const lastSyncAt =
    syncStatus?.lastSync?.completedAt ?? syncStatus?.lastSync?.startedAt ?? null;

  // Token expiry — derive from connectedAt if no explicit expiry is exposed.
  // Zoho access tokens are valid for 1 hour by default; refresh tokens for
  // longer. We use connectedAt + 1h as a best-effort upper bound; if the
  // token has already been refreshed (lastConnectedAt), use that instead.
  const refreshTokenBase =
    status.lastConnectedAt ?? status.connectedAt ?? null;
  const tokenExpiresAt = refreshTokenBase
    ? new Date(new Date(refreshTokenBase).getTime() + 60 * 60 * 1000).toISOString()
    : null;

  // Has any data been synced? Drives whether insights + latest records show.
  const hasSyncedData =
    !!syncStatus?.lastSync && (syncStatus.totalRecords ?? 0) > 0;

  const handleSyncNow = useCallback(async () => {
    const result = await onSyncNow();
    if (!result.ok && result.error) {
      toast.error("We couldn't start the sync", {
        description: result.error,
        action: { label: 'Retry', onClick: () => void onSyncNow() },
      });
    } else if (result.ok) {
      toast.success('Sync started', {
        description: 'Pulling the latest records from Zoho Books.',
      });
    }
    return result;
  }, [onSyncNow]);

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* (a) Sticky connection header */}
      <ZohoHeader
        organizationName={status.organizationName}
        dataCenter={status.dataCenter}
        lastSyncAt={lastSyncAt}
        tokenExpiresAt={tokenExpiresAt}
        syncing={syncing}
        pending={pending}
        onSyncNow={handleSyncNow}
        onRefreshToken={onRefreshToken}
        onDisconnect={onDisconnect}
      />

      {/* (b) KPI row */}
      <ZohoKpiRow syncStatus={syncStatus} syncing={syncing} />

      {/* (c) Modules grid */}
      <ZohoModulesGrid
        syncStatus={syncStatus}
        syncing={syncing}
        onSyncNow={handleSyncNow}
      />

      {/* (d) Sync history timeline */}
      <ZohoSyncHistory
        syncStatus={syncStatus}
        syncing={syncing}
        onSyncNow={handleSyncNow}
      />

      {/* (e) Oracle AI insights — HIDDEN until first sync (RULE 3e) */}
      {hasSyncedData ? <ZohoOracleInsights /> : null}

      {/* (f) Latest synced records — HIDDEN until first sync (RULE 3f) */}
      {hasSyncedData ? <ZohoLatestRecords syncStatus={syncStatus} /> : null}
    </div>
  );
}

export default ZohoConnected;
