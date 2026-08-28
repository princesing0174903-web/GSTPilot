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

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { PremiumErrorState } from '@/components/ui/premium-error-state';
import { useZohoBooks } from '@/hooks/useZohoBooks';
import { ZohoDisconnected } from './ZohoDisconnected';
import { ZohoConnected } from './ZohoConnected';
import { ZohoDashboardSkeleton } from './ZohoSkeletons';

// ─── OAuth callback banner ───────────────────────────────────────────────────
// Reads ?zoho_connected=1 / ?zoho_error= / ?zoho_stage= from the URL after the
// OAuth callback redirect. Shows a premium toast-style banner at the top of
// the page, then cleans the URL. NEVER exposes secrets — only the stage name
// + a human-readable error.
const STAGE_LABELS: Record<string, string> = {
  authorization: 'Zoho authorization',
  state: 'OAuth state validation',
  token_exchange: 'Token exchange',
  token_storage: 'Secure token storage',
  organization: 'Organization lookup',
  books_api: 'Zoho Books API',
  token_refresh: 'Token refresh',
};

function OAuthBanner() {
  // Read OAuth callback params ONCE during initial state (lazy initializer).
  // This avoids the React 19 "setState in effect" anti-pattern.
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string; stage?: string } | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('zoho_connected');
    const error = params.get('zoho_error');
    const stage = params.get('zoho_stage');
    if (connected === '1') {
      return { type: 'success', message: 'Zoho Books connected successfully.' };
    }
    if (error) {
      const stageLabel = stage ? STAGE_LABELS[stage] ?? stage : undefined;
      return {
        type: 'error',
        message: stageLabel ? `Connection failed at: ${stageLabel}. ${error}` : error,
        stage: stage ?? undefined,
      };
    }
    return null;
  });

  // Clean the URL once on mount (remove zoho_* params) so the banner doesn't
  // reappear on refresh. This is a side-effect on an external system (the URL
  // bar) — no setState call.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('zoho_connected') || params.get('zoho_error')) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete('zoho_connected');
      clean.searchParams.delete('zoho_error');
      clean.searchParams.delete('zoho_stage');
      window.history.replaceState({}, '', clean.toString());
    }
  }, []);

  if (!banner) return null;

  return (
    <div
      role="alert"
      className={`mb-4 flex items-start gap-3 rounded-xl border p-4 ${
        banner.type === 'success'
          ? 'border-emerald-500/30 bg-emerald-500/10'
          : 'border-red-500/30 bg-red-500/10'
      }`}
    >
      {banner.type === 'success' ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
      ) : (
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${banner.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
          {banner.type === 'success' ? 'Connected' : 'Connection issue'}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{banner.message}</p>
      </div>
      <button
        type="button"
        onClick={() => setBanner(null)}
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

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
    verifyConnection,
    organizations,
    organizationsLoading,
    listOrganizations,
    selectOrganization,
    contextReady,
  } = useZohoBooks();

  // Wrap the hook's sync trigger so the page can pass a single callback down.
  const handleSyncNow = useCallback(
    () => triggerSync({ mode: 'incremental', resume: true }),
    [triggerSync],
  );

  const handleVerify = useCallback(
    () => verifyConnection(),
    [verifyConnection],
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
  // This covers THREE honest sub-states:
  //   (a) No token row at all → fresh "Connect Zoho Books" screen
  //   (b) Token row exists but ZOHO_CLIENT_ID/SECRET missing → "Configuration
  //       required" notice is shown by ZohoDisconnected (it calls /connect and
  //       the server returns ZOHO_NOT_CONFIGURED).
  //   (c) Token row exists but tokens can't be decrypted (secret rotated) →
  //       show a "Reconnect" prompt so the user knows the old connection is
  //       stale and must be re-authorized.
  if (!status?.connected) {
    return (
      <div>
        <OAuthBanner />
        <ZohoDisconnected
          connect={connect}
          requiresReconnect={status?.requiresReconnect ?? false}
          reason={status?.reason ?? null}
          lastConnectedAt={status?.lastConnectedAt ?? null}
          organizationName={status?.organizationName ?? null}
          contextReady={contextReady}
        />
      </div>
    );
  }

  // ─── STATE 3: Connected → full dashboard ───
  return (
    <div>
      <OAuthBanner />
      <ZohoConnected
        status={status}
        syncStatus={syncStatus}
        syncing={syncing}
        pending={pending}
        onSyncNow={handleSyncNow}
        onRefreshToken={refresh}
        onDisconnect={disconnect}
        onVerify={handleVerify}
        organizations={organizations}
        organizationsLoading={organizationsLoading}
        onListOrganizations={listOrganizations}
        onSelectOrganization={selectOrganization}
      />
    </div>
  );
}
