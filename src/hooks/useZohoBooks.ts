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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import { invalidateBusinessSnapshot } from '@/lib/business-snapshot-events';

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
  | 'item'
  | 'creditnote';

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
    currentEntity: ZohoSyncEntity | null;
  } | null;
  recordsImported: Partial<Record<ZohoSyncEntity, number>>;
  totalRecords: number;
  isRunning: boolean;
}

// ─── Phase 4 — Customer Sync types ───────────────────────────────────────────

export interface ZohoCustomerAddress {
  attention?: string;
  address?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
}

export interface ZohoCustomerRecord {
  id: string;
  organizationId: string;
  zohoOrgId: string;
  zohoContactId: string;
  contactName: string;
  companyName: string | null;
  gstNumber: string | null;
  email: string | null;
  phone: string | null;
  currency: string | null;
  paymentTerms: number | null;
  outstandingReceivable: number;
  status: string;
  billingAddress: string | null;
  shippingAddress: string | null;
  lastSyncedAt: string;
  zohoCreatedAt: string | null;
  zohoUpdatedAt: string | null;
}

export interface ZohoCustomerInput {
  contactName: string;
  companyName?: string | null;
  gstNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  currency?: string | null;
  paymentTerms?: number | null;
  billingAddress?: ZohoCustomerAddress | null;
  shippingAddress?: ZohoCustomerAddress | null;
}

export interface ZohoCustomerSyncResult {
  ok: boolean;
  status: 'completed' | 'partial' | 'failed';
  totalFetched: number;
  imported: number;
  updated: number;
  failed: number;
  durationMs: number;
  lastSyncedAt: string | null;
  syncRunId: string | null;
  error: string | null;
}

export interface ZohoCustomerSyncStatus {
  ok: boolean;
  connected: boolean;
  zohoOrgId: string | null;
  organizationName: string | null;
  customerCount: number;
  lastSync: {
    id: string;
    trigger: 'manual' | 'auto';
    status: 'running' | 'completed' | 'partial' | 'failed';
    totalFetched: number;
    imported: number;
    updated: number;
    failed: number;
    durationMs: number;
    error: string | null;
    startedAt: string;
    completedAt: string | null;
  } | null;
  autoSync: { enabled: boolean; intervalMinutes: number };
}

export interface ZohoCustomerWriteResult {
  ok: boolean;
  httpStatus: number;
  customer: ZohoCustomerRecord | null;
  error: string | null;
  zohoCode: number | null;
  zohoMessage: string | null;
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
  const { user } = useAuth();

  const [status, setStatus] = useState<ZohoConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Phase 2 — Data Sync state
  const [syncStatus, setSyncStatus] = useState<ZohoSyncStatusInfo | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Phase 4 — Customer Sync state
  const [customers, setCustomers] = useState<ZohoCustomerRecord[]>([]);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const [customerSyncRunning, setCustomerSyncRunning] = useState(false);
  const [customerSyncStatus, setCustomerSyncStatus] = useState<ZohoCustomerSyncStatus | null>(null);
  const [customerSyncResult, setCustomerSyncResult] = useState<ZohoCustomerSyncResult | null>(null);

  const orgId = organization?.id ?? null;
  const userId = user?.id ?? null;

  const refreshStatus = useCallback(async () => {
    // Skip until BOTH orgId + userId are present. Calling /status with an
    // empty actor.uid would force the route to return its
    // `requiresAuth: true` placeholder forever (the user never "logs in"),
    // which the UI would misread as "credentials not configured".
    if (!orgId || !userId) return;
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
  }, [orgId, userId, buildHeaders]);

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

  // Phase 5 — trigger a manual sync (POST /api/integrations/zoho/sync)
  //
  // Fire-and-forget: the POST starts the sync in the background and returns
  // immediately with { status: 'running' }. We set `syncing=true` and start
  // polling GET /sync/status every 1.5s for live progress (currentEntity,
  // per-entity counts). Polling stops when the sync status transitions away
  // from 'running' (→ completed | partial | failed).
  const triggerSync = useCallback(
    async (opts?: { mode?: ZohoSyncMode; resume?: boolean }): Promise<{
      ok: boolean;
      error: string | null;
    }> => {
      setSyncing(true);
      setSyncError(null);

      const res = await zfetch<{ ok: boolean; status: string; mode: string; message?: string }>(
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

      if (!res.ok) {
        setSyncing(false);
        setSyncError(res.error);
        return { ok: false, error: res.error };
      }

      // Sync started in background — kick off polling for live progress.
      // First poll immediately so the UI shows "Connecting…" → "Fetching X…"
      // without a 1.5s delay.
      void refreshSyncStatus();

      // Clear any existing poll interval (e.g., user clicks Sync twice).
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        await refreshSyncStatus();
        // Stop polling once the sync is no longer running.
        // refreshSyncStatus updates syncStatus — read the latest from state
        // via a functional check.
        setSyncStatus((prev) => {
          if (prev?.isRunning === false) {
            setSyncing(false);
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
          return prev;
        });
      }, 1500);

      return { ok: true, error: null };
    },
    [buildHeaders, refreshSyncStatus],
  );

  // Cleanup polling on unmount.
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

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

  // ─── Phase 4 — Customer Sync ──────────────────────────────────────────────

  /** Fetch the customer-sync status (last run, count, auto-sync flag). */
  const refreshCustomerSyncStatus = useCallback(async (): Promise<ZohoCustomerSyncStatus | null> => {
    if (!orgId) return null;
    const res = await zfetch<ZohoCustomerSyncStatus>(
      '/api/integrations/zoho/customers/sync-status',
      buildHeaders(),
    );
    if (res.ok && res.data) {
      setCustomerSyncStatus(res.data);
      return res.data;
    }
    return null;
  }, [orgId, buildHeaders]);

  /** List synced customers from the DB (with optional search + pagination). */
  const listCustomers = useCallback(
    async (opts?: {
      search?: string;
      status?: 'active' | 'inactive' | 'all';
      limit?: number;
      offset?: number;
    }): Promise<{ ok: boolean; customers: ZohoCustomerRecord[]; total: number; error: string | null }> => {
      setCustomersLoading(true);
      setCustomersError(null);
      const url = new URL('/api/integrations/zoho/customers', window.location.origin);
      if (opts?.search) url.searchParams.set('search', opts.search);
      if (opts?.status) url.searchParams.set('status', opts.status);
      if (typeof opts?.limit === 'number') url.searchParams.set('limit', String(opts.limit));
      if (typeof opts?.offset === 'number') url.searchParams.set('offset', String(opts.offset));
      const res = await zfetch<{ ok: boolean; customers: ZohoCustomerRecord[]; total: number }>(
        `${url.pathname}${url.search}`,
        buildHeaders(),
      );
      setCustomersLoading(false);
      if (res.ok && res.data) {
        setCustomers(res.data.customers);
        setCustomersTotal(res.data.total);
        return { ok: true, customers: res.data.customers, total: res.data.total, error: null };
      }
      setCustomersError(res.error);
      return { ok: false, customers: [], total: 0, error: res.error };
    },
    [buildHeaders],
  );

  /** Trigger a real customer sync (POST /api/integrations/zoho/customers/sync). */
  const syncCustomers = useCallback(
    async (opts?: { trigger?: 'manual' | 'auto' }): Promise<ZohoCustomerSyncResult> => {
      setCustomerSyncRunning(true);
      setCustomerSyncResult(null);
      const res = await zfetch<ZohoCustomerSyncResult>(
        '/api/integrations/zoho/customers/sync',
        buildHeaders(),
        {
          method: 'POST',
          body: JSON.stringify({ trigger: opts?.trigger ?? 'manual' }),
        },
      );
      setCustomerSyncRunning(false);
      const result: ZohoCustomerSyncResult = res.data ?? {
        ok: false,
        status: 'failed',
        totalFetched: 0,
        imported: 0,
        updated: 0,
        failed: 0,
        durationMs: 0,
        lastSyncedAt: null,
        syncRunId: null,
        error: res.error ?? 'Sync failed.',
      };
      setCustomerSyncResult(result);
      // Refresh the sync-status + customer list so the UI reflects the new state.
      await Promise.all([refreshCustomerSyncStatus(), listCustomers()]);
      return result;
    },
    [buildHeaders, refreshCustomerSyncStatus, listCustomers],
  );

  /** Create a customer (POST /api/integrations/zoho/customers → POST /contacts). */
  const createCustomer = useCallback(
    async (input: ZohoCustomerInput): Promise<ZohoCustomerWriteResult> => {
      setPending(true);
      const res = await zfetch<ZohoCustomerWriteResult>(
        '/api/integrations/zoho/customers',
        buildHeaders(),
        { method: 'POST', body: JSON.stringify(input) },
      );
      setPending(false);
      const result: ZohoCustomerWriteResult = res.data ?? {
        ok: false,
        httpStatus: res.status,
        customer: null,
        error: res.error ?? 'Failed to create customer.',
        zohoCode: null,
        zohoMessage: null,
      };
      if (result.ok) {
        // Refresh the customer list to include the new row.
        await listCustomers();
        // Invalidate the business snapshot so the dashboard customer count
        // + Oracle context update INSTANTLY (no 60-second wait).
        invalidateBusinessSnapshot();
      }
      return result;
    },
    [buildHeaders, listCustomers],
  );

  /** Update a customer (PUT /api/integrations/zoho/customers/{id} → PUT /contacts/{id}). */
  const updateCustomer = useCallback(
    async (id: string, input: ZohoCustomerInput): Promise<ZohoCustomerWriteResult> => {
      setPending(true);
      const res = await zfetch<ZohoCustomerWriteResult>(
        `/api/integrations/zoho/customers/${encodeURIComponent(id)}`,
        buildHeaders(),
        { method: 'PUT', body: JSON.stringify(input) },
      );
      setPending(false);
      const result: ZohoCustomerWriteResult = res.data ?? {
        ok: false,
        httpStatus: res.status,
        customer: null,
        error: res.error ?? 'Failed to update customer.',
        zohoCode: null,
        zohoMessage: null,
      };
      if (result.ok) {
        await listCustomers();
        // Invalidate the business snapshot so dashboards reflect the update.
        invalidateBusinessSnapshot();
      }
      return result;
    },
    [buildHeaders, listCustomers],
  );

  /** Toggle the auto-sync flag (POST /api/integrations/zoho/customers/auto-sync). */
  const toggleAutoSync = useCallback(
    async (enabled: boolean, intervalMinutes?: number): Promise<{
      ok: boolean;
      autoSync: { enabled: boolean; intervalMinutes: number } | null;
      error: string | null;
    }> => {
      const res = await zfetch<{
        ok: boolean;
        autoSync: { enabled: boolean; intervalMinutes: number };
        error?: string;
      }>('/api/integrations/zoho/customers/auto-sync', buildHeaders(), {
        method: 'POST',
        body: JSON.stringify({ enabled, intervalMinutes }),
      });
      if (res.ok && res.data) {
        // Refresh the sync-status so the UI reflects the new flag.
        await refreshCustomerSyncStatus();
        return { ok: true, autoSync: res.data.autoSync, error: null };
      }
      return { ok: false, autoSync: null, error: res.error };
    },
    [buildHeaders, refreshCustomerSyncStatus],
  );

  // Initial load: fetch the customer-sync status + customer list when the org changes.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!orgId) return;
    void refreshCustomerSyncStatus();
    void listCustomers();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [orgId, refreshCustomerSyncStatus, listCustomers]);

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
    // Phase 4 — Customer Sync
    customers,
    customersTotal,
    customersLoading,
    customersError,
    customerSyncStatus,
    customerSyncRunning,
    customerSyncResult,
    refreshCustomerSyncStatus,
    listCustomers,
    syncCustomers,
    createCustomer,
    updateCustomer,
    toggleAutoSync,
  };
}
