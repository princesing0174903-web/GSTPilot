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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshStatus();
  }, [refreshStatus]);

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
  };
}
