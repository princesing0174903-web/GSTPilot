'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useZohoBooks Hook
//
// Client-side hook for the Zoho Books integration. Mirrors the
// `useGoogleWorkspace` hook exactly so the integration pages have a consistent
// shape: status polling, connect / disconnect / refresh, and a generic `call`
// helper for future service routes.
//
// All API calls go through the gateway-relative path
// /api/integrations/zoho/* — never absolute URLs.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ZohoConnectionStatus {
  connected: boolean;
  userEmail: string | null;
  zohoUserId: string | null;
  connectedAt: string | null;
  /** ISO timestamp of the last token update (refresh / reconnect). */
  lastConnectedAt: string | null;
  scopes: string[];
  /** Zoho Books organization display name (multi-tenant mapping). */
  organizationName: string | null;
  /** Zoho Books numeric organization ID. */
  zohoOrgId: string | null;
  /** Zoho data center (in / com / eu / …). */
  dataCenter: string | null;
  /** Functional scope areas covered (Books, Invoices, Customers, …). */
  scopeAreas: string[];
}

// ─── Phase 2 — Data Sync types ───────────────────────────────────────────────

export interface ZohoEntitySyncStats {
  imported: number;
  updated: number;
  failed: number;
  skipped: number;
  pages: number;
  lastError: string | null;
}

export type ZohoSyncEntity =
  | 'customer'
  | 'vendor'
  | 'tax'
  | 'bank_account'
  | 'invoice'
  | 'bill'
  | 'expense'
  | 'bank_transaction'
  | 'journal'
  | 'payment'
  | 'item';

export type ZohoSyncMode = 'full' | 'incremental';
export type ZohoSyncStatus = 'running' | 'completed' | 'failed' | 'partial';

// ─── Test Connection types ───────────────────────────────────────────────────

/** Organization detail returned by the Test Connection probe. */
export interface ZohoTestConnectionOrganization {
  organization_id: string;
  name: string;
  is_org_active: boolean | null;
  is_default_org: boolean | null;
  plan_name: string | null;
  plan_type: string | null;
  contact_name: string | null;
  email: string | null;
  country_name: string | null;
  country_code: string | null;
  currency_code: string | null;
  currency_symbol: string | null;
  time_zone: string | null;
  gst_no: string | null;
}

export interface ZohoSyncStatusInfo {
  connected: boolean;
  organizationName: string | null;
  zohoOrgId: string | null;
  lastSync: {
    id: string;
    status: ZohoSyncStatus;
    mode: ZohoSyncMode;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    error: string | null;
    stats: Partial<Record<ZohoSyncEntity, ZohoEntitySyncStats>>;
  } | null;
  recordsImported: Partial<Record<ZohoSyncEntity, number>>;
  totalRecords: number;
  isRunning: boolean;
}

interface ApiError {
  error: string;
}

// ─── Header builder ──────────────────────────────────────────────────────────

function useZohoHeaders() {
  const { organization, membership, role } = useOrg();
  const { user } = useAuth();

  const buildHeaders = useCallback(
    (extra: Record<string, string> = {}): Record<string, string> => ({
      'Content-Type': 'application/json',
      'x-gstpilot-orgid': organization?.id ?? '',
      'x-gstpilot-actor': JSON.stringify({
        uid: user?.id ?? membership?.userId ?? '',
        email: user?.email ?? membership?.userEmail ?? '',
        name: user?.name ?? membership?.userDisplayName ?? null,
        role: role ?? null,
      }),
      ...extra,
    }),
    [organization?.id, user?.id, user?.email, user?.name, membership, role],
  );

  return buildHeaders;
}

// ─── Fetch helper ────────────────────────────────────────────────────────────

async function zfetch<T>(
  path: string,
  headers: Record<string, string>,
  init?: RequestInit,
): Promise<{ ok: boolean; data: T | null; error: string | null; status: number }> {
  try {
    const res = await fetch(path, { ...init, headers });
    const body = (await res.json().catch(() => ({}))) as (T & Partial<ApiError>) | ApiError;
    if (!res.ok) {
      const error = ('error' in body && body.error) || `Request failed (${res.status})`;
      return { ok: false, data: null, error, status: res.status };
    }
    return { ok: true, data: body as T, error: null, status: res.status };
  } catch (err) {
    return {
      ok: false,
      data: null,
      error: err instanceof Error ? err.message : 'Network error.',
      status: 0,
    };
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useZohoBooks() {
  const buildHeaders = useZohoHeaders();
  const { organization } = useOrg();

  const [status, setStatus] = useState<ZohoConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Phase 2 — Data Sync state
  const [syncStatus, setSyncStatus] = useState<ZohoSyncStatusInfo | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const orgId = organization?.id ?? null;

  const refreshStatus = useCallback(async () => {
    if (!orgId) return;
    setStatusLoading(true);
    setStatusError(null);
    const res = await zfetch<{ ok: boolean; status: ZohoConnectionStatus }>(
      '/api/integrations/zoho/status',
      buildHeaders(),
    );
    if (res.ok && res.data) {
      setStatus(res.data.status);
    } else {
      setStatusError(res.error);
    }
    setStatusLoading(false);
  }, [orgId, buildHeaders]);

  // Phase 2 — fetch sync status (separate endpoint from connection status)
  const refreshSyncStatus = useCallback(async () => {
    if (!orgId) return;
    setSyncLoading(true);
    setSyncError(null);
    const res = await zfetch<{ ok: boolean; status: ZohoSyncStatusInfo }>(
      '/api/integrations/zoho/sync/status',
      buildHeaders(),
    );
    if (res.ok && res.data) {
      setSyncStatus(res.data.status);
      setSyncing(res.data.status?.isRunning ?? false);
    } else {
      setSyncError(res.error);
    }
    setSyncLoading(false);
  }, [orgId, buildHeaders]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    void refreshStatus();
    void refreshSyncStatus();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [refreshStatus, refreshSyncStatus]);

  // Phase 2 — trigger a manual sync (POST /api/integrations/zoho/sync)
  const triggerSync = useCallback(
    async (opts?: { mode?: ZohoSyncMode; resume?: boolean }): Promise<{
      ok: boolean;
      error: string | null;
    }> => {
      setSyncing(true);
      setSyncError(null);
      const res = await zfetch<{ ok: boolean; syncLogId: string; status: ZohoSyncStatus; stats: Record<string, ZohoEntitySyncStats>; error: string | null }>(
        '/api/integrations/zoho/sync',
        buildHeaders(),
        {
          method: 'POST',
          body: JSON.stringify({
            mode: opts?.mode ?? 'incremental',
            resume: opts?.resume ?? true,
          }),
        },
      );
      setSyncing(false);
      // Refresh both the sync status (for fresh stats) and the connection
      // status (in case the watermark changed).
      await refreshSyncStatus();
      return { ok: res.ok, error: res.error };
    },
    [buildHeaders, refreshSyncStatus],
  );

  const connect = useCallback(async (): Promise<{ authUrl: string | null; error: string | null }> => {
    let bearer = '';
    try {
      if (auth.currentUser) {
        bearer = await auth.currentUser.getIdToken();
      }
    } catch {
      /* ignore — preview mode */
    }
    const headers = buildHeaders(bearer ? { Authorization: `Bearer ${bearer}` } : {});
    const res = await zfetch<{ ok: boolean; authUrl: string }>(
      '/api/integrations/zoho/connect?return=/zoho-books',
      headers,
    );
    return { authUrl: res.data?.authUrl ?? null, error: res.error };
  }, [buildHeaders]);

  const disconnect = useCallback(async (): Promise<{ error: string | null }> => {
    setPending(true);
    const res = await zfetch<{ ok: boolean }>(
      '/api/integrations/zoho/disconnect',
      buildHeaders(),
      { method: 'POST' },
    );
    setPending(false);
    if (!res.error) {
      await refreshStatus();
    }
    return { error: res.error };
  }, [buildHeaders, refreshStatus]);

  const refresh = useCallback(async (): Promise<{ error: string | null; organizationName: string | null }> => {
    setPending(true);
    const res = await zfetch<{ ok: boolean; organizationName: string | null; zohoOrgId: string | null }>(
      '/api/integrations/zoho/refresh',
      buildHeaders(),
      { method: 'POST' },
    );
    setPending(false);
    if (!res.error) {
      await refreshStatus();
    }
    return {
      error: res.error,
      organizationName: res.data?.organizationName ?? null,
    };
  }, [buildHeaders, refreshStatus]);

  const call = useCallback(
    async <T>(path: string, init?: RequestInit): Promise<{ ok: boolean; data: T | null; error: string | null }> => {
      setPending(true);
      const res = await zfetch<T>(path, buildHeaders(), init);
      setPending(false);
      return res;
    },
    [buildHeaders],
  );

  // ─── Test Connection ───────────────────────────────────────────────────────
  // Calls POST /api/integrations/zoho/test which probes Zoho Books with a real
  // authenticated GET /organizations/{org_id} request. Returns a detailed,
  // human-readable result so the UI can show "Connection Successful" or a
  // specific error message (401 / 403 / 404 / 429 / 5xx / network).
  const testConnection = useCallback(async (): Promise<{
    ok: boolean;
    httpStatus: number;
    organization: ZohoTestConnectionOrganization | null;
    error: string | null;
    testedAt: string | null;
  }> => {
    setPending(true);
    const res = await zfetch<{
      ok: boolean;
      connected: boolean;
      httpStatus: number;
      organization?: ZohoTestConnectionOrganization;
      error?: string;
      testedAt?: string;
      needsReconnect?: boolean;
    }>('/api/integrations/zoho/test', buildHeaders(), { method: 'POST' });
    setPending(false);
    return {
      ok: res.ok,
      httpStatus: res.data?.httpStatus ?? res.status,
      organization: res.data?.organization ?? null,
      error: res.error ?? res.data?.error ?? null,
      testedAt: res.data?.testedAt ?? null,
    };
  }, [buildHeaders]);

  return {
    status,
    statusLoading,
    statusError,
    refreshStatus,
    connect,
    disconnect,
    refresh,
    pending,
    call,
    // Test Connection
    testConnection,
    // Phase 2 — Data Sync
    syncStatus,
    syncLoading,
    syncError,
    syncing,
    refreshSyncStatus,
    triggerSync,
  };
}
