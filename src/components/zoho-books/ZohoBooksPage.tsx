'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books Page (Redesigned · POLISH-07)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Single-route SPA view registered at `?view=zoho-books`. ~150 lines —
// intentionally lean. This file is a STATE ROUTER between two modes:
//
//   ┌─────────────────────────────────────────────────────────────────────┐
//   │  STATE 1: status === null           → Premium skeleton              │
//   │  STATE 2: status.connected === false → ZohoDisconnected (hero card) │
//   │  STATE 3: status.connected === true  → ZohoConnected (dashboard)    │
//   └─────────────────────────────────────────────────────────────────────┘
//
// RULE 1: ONE SOURCE OF TRUTH. The page NEVER renders KPIs, modules,
// history, insights, or latest records in disconnected mode. The hook's
// `status.connected` boolean is the only decision point.
//
// RULE 4: Loading state = premium skeleton that mirrors the connected layout.
//   No "Loading..." text anywhere.
//
// RULE 5: Error state = premium error card with "Try again" CTA. No raw
//   errors, no stack traces, no JSON.
//
// All actions (connect / disconnect / refresh / sync) come from the
// `useZohoBooks` hook and are passed down as props.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { PremiumErrorState } from '@/components/ui/premium-error-state';
import { useZohoBooks } from '@/hooks/useZohoBooks';
import { ZohoDisconnected } from './ZohoDisconnected';
import { ZohoConnected } from './ZohoConnected';
import { ZohoDashboardSkeleton } from './ZohoSkeletons';

export default function ZohoBooksPage() {
  const {
    status,
    statusLoading,
    statusError,
    refreshStatus,
    connect,
    disconnect,
    refresh,
    pending,
    syncStatus,
    syncing,
    triggerSync,
  } = useZohoBooks();

  // Wrap the hook's sync trigger so the page can pass a single callback down.
  const handleSyncNow = useCallback(
    () => triggerSync({ mode: 'incremental', resume: true }),
    [triggerSync],
  );

  // ─── STATE 1: Initial load → premium skeleton ───
  if (statusLoading && !status) {
    return <ZohoDashboardSkeleton />;
  }

  // ─── STATE 5: Status check failed → premium error card ───
  if (statusError && !status) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <PremiumErrorState
          icon={<AlertTriangle className="h-8 w-8" />}
          title="Couldn't reach Zoho Books"
          description="We couldn't verify your Zoho Books connection. Your data is safe — please try again."
          onRetry={() => void refreshStatus()}
          retryLabel="Try again"
        />
      </div>
    );
  }

  // ─── STATE 2: Disconnected → ONLY the premium connection screen ───
  if (!status?.connected) {
    return <ZohoDisconnected connect={connect} />;
  }

  // ─── STATE 3: Connected → full dashboard ───
  return (
    <ZohoConnected
      status={status}
      syncStatus={syncStatus}
      syncing={syncing}
      pending={pending}
      onSyncNow={handleSyncNow}
      onRefreshToken={refresh}
      onDisconnect={disconnect}
    />
  );
}
