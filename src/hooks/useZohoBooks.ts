'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — useZohoBooks() Hook
// ═══════════════════════════════════════════════════════════════════════════════
// Client-side hook for the Zoho Books integration.
//
// • Stamps every API request with `x-gstpilot-orgid` + `x-gstpilot-actor`
//   headers (mirrors `useGoogleWorkspace` + `useConnectedSources`).
// • `contextReady` is `true` ONLY when both org + user are resolved. The
//   Connect button stays disabled until this flips, so we never send a
//   request with empty headers (which the routes correctly reject with 400).
// • `connect()` returns the OAuth consent URL — the caller (ZohoBooksPage)
//   redirects the browser to it.
// • `call<T>()` is a generic authenticated fetch wrapper for the proxied
//   Zoho API routes (organizations / customers / invoices / bills / payments).
// • Convenience wrappers: `listOrganizations()`, `selectOrganization(orgId)`,
//   `listCustomers()`, `listInvoices()`, `listBills()`, `listPayments()`.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { useOrgUserHeaders } from '@/hooks/useOrgUserHeaders';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ZohoStatus {
  connected: boolean;
  state: 'live' | 'stale' | 'disconnected' | 'unknown';
  email: string | null;
  zohoUserId: string | null;
  zohoOrgId: string | null;
  zohoOrgName: string | null;
  dataCenter: string | null;
  apiDomain: string | null;
  connectedAt: string | null;
  updatedAt: string | null;
  expiryDate: string | null;
  scope: string | null;
  error: string | null;
  permanent: boolean;
}

interface ConnectResponse {
  ok: boolean;
  authUrl?: string;
  redirectUri?: string;
  error?: string;
  code?: string;
  requiredEnvVars?: string[];
}

interface StatusResponse {
  ok: boolean;
  status?: ZohoStatus;
  error?: string;
  code?: string;
}

interface DisconnectResponse {
  ok: boolean;
  error?: string;
}

interface RefreshResponse {
  ok: boolean;
  status?: ZohoStatus;
  error?: string;
  code?: string;
}

export interface ZohoOrganization {
  organization_id: string;
  name: string;
  contact_name?: string;
  email?: string;
  is_default_org?: boolean;
  plan_type?: string;
  country_name?: string;
  currency_code?: string;
  gst_no?: string;
}

export interface ZohoContact {
  contact_id: string;
  contact_name: string;
  company_name?: string;
  contact_type?: string;
  status?: string;
  email?: string;
  phone?: string;
  website?: string;
  currency_code?: string;
  outstanding_receivable_amount?: number;
  outstanding_payable_amount?: number;
  created_time?: string;
  last_modified_time?: string;
}

export interface ZohoInvoice {
  invoice_id: string;
  invoice_number: string;
  status?: string;
  customer_name?: string;
  customer_id?: string;
  date?: string;
  due_date?: string;
  total?: number;
  balance?: number;
  currency_code?: string;
  created_time?: string;
  last_modified_time?: string;
}

export interface ZohoBill {
  bill_id: string;
  bill_number: string;
  status?: string;
  vendor_name?: string;
  vendor_id?: string;
  date?: string;
  due_date?: string;
  total?: number;
  balance?: number;
  currency_code?: string;
  created_time?: string;
  last_modified_time?: string;
}

export interface ZohoPayment {
  payment_id: string;
  payment_number?: string;
  payment_mode?: string;
  customer_name?: string;
  customer_id?: string;
  amount?: number;
  date?: string;
  reference_number?: string;
  currency_code?: string;
  invoice_numbers?: string;
  created_time?: string;
}

export interface UseZohoBooksResult {
  // ── Status ──
  status: ZohoStatus | null;
  statusLoading: boolean;
  statusError: string | null;
  refreshStatus: () => Promise<void>;

  // ── Context ──
  contextReady: boolean;

  // ── Actions ──
  connect: () => Promise<{
    authUrl: string | null;
    error: string | null;
    notConfigured: boolean;
    requiredEnvVars: string[];
  }>;
  disconnect: () => Promise<{ error: string | null }>;
  refresh: () => Promise<{ error: string | null }>;
  pending: boolean;

  // ── Convenience wrappers ──
  listOrganizations: () => Promise<{
    data: ZohoOrganization[] | null;
    selectedOrgId: string | null;
    error: string | null;
  }>;
  selectOrganization: (
    orgId: string,
    orgName?: string
  ) => Promise<{ error: string | null }>;
  listCustomers: (max?: number) => Promise<{
    data: ZohoContact[] | null;
    error: string | null;
  }>;
  listInvoices: (max?: number) => Promise<{
    data: ZohoInvoice[] | null;
    error: string | null;
  }>;
  listBills: (max?: number) => Promise<{
    data: ZohoBill[] | null;
    error: string | null;
  }>;
  listPayments: (max?: number) => Promise<{
    data: ZohoPayment[] | null;
    error: string | null;
  }>;
}

// ── Initial state ─────────────────────────────────────────────────────────────

const UNKNOWN_STATUS: ZohoStatus = {
  connected: false,
  state: 'unknown',
  email: null,
  zohoUserId: null,
  zohoOrgId: null,
  zohoOrgName: null,
  dataCenter: null,
  apiDomain: null,
  connectedAt: null,
  updatedAt: null,
  expiryDate: null,
  scope: null,
  error: null,
  permanent: false,
};

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useZohoBooks(): UseZohoBooksResult {
  const buildHeadersCtx = useOrgUserHeaders();
  const contextReady = buildHeadersCtx().contextReady;

  const [status, setStatus] = useState<ZohoStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // ── Header builder ──
  // Delegates to the canonical useOrgUserHeaders() so all integration hooks
  // (useZohoBooks + useGoogleWorkspace + useConnectedSources) emit an
  // identical `x-gstpilot-orgid` + `x-gstpilot-actor` JSON shape.
  const buildHeaders = useCallback(
    (extra?: Record<string, string>): Record<string, string> => ({
      ...buildHeadersCtx().headers,
      ...(extra ?? {}),
    }),
    [buildHeadersCtx]
  );

  // ── Status ──
  const refreshStatus = useCallback(async () => {
    const { orgId, userId } = buildHeadersCtx();
    if (!orgId || !userId) {
      setStatus(UNKNOWN_STATUS);
      return;
    }
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await fetch('/api/integrations/zoho/status', {
        headers: buildHeaders(),
        cache: 'no-store',
      });
      const body = (await res.json().catch(() => ({}))) as StatusResponse;
      if (!res.ok || !body.ok || !body.status) {
        setStatus(UNKNOWN_STATUS);
        setStatusError(body?.error ?? 'Failed to load Zoho status.');
        return;
      }
      setStatus(body.status);
    } catch (e) {
      setStatus(UNKNOWN_STATUS);
      setStatusError((e as Error).message);
    } finally {
      setStatusLoading(false);
    }
  }, [buildHeadersCtx, buildHeaders]);

  // Auto-load status when context becomes ready.
  useEffect(() => {
    if (contextReady) {
      void refreshStatus();
    }
  }, [contextReady, refreshStatus]);

  // ── Connect ──
  const connect = useCallback(async () => {
    if (!contextReady) {
      return {
        authUrl: null,
        error: 'Loading workspace… please wait.',
        notConfigured: false,
        requiredEnvVars: [],
      };
    }
    setPending(true);
    try {
      const res = await fetch('/api/integrations/zoho/connect', {
        headers: buildHeaders(),
        cache: 'no-store',
      });
      const body = (await res.json().catch(() => ({}))) as ConnectResponse;
      if (!res.ok || !body.ok || !body.authUrl) {
        const notConfigured = body.code === 'ZOHO_NOT_CONFIGURED';
        return {
          authUrl: null,
          error:
            body.error ??
            (notConfigured
              ? 'Zoho Books OAuth is not configured on this server.'
              : 'Failed to start Zoho connect.'),
          notConfigured,
          requiredEnvVars: body.requiredEnvVars ?? [],
        };
      }
      return {
        authUrl: body.authUrl,
        error: null,
        notConfigured: false,
        requiredEnvVars: [],
      };
    } catch (e) {
      return {
        authUrl: null,
        error: (e as Error).message,
        notConfigured: false,
        requiredEnvVars: [],
      };
    } finally {
      setPending(false);
    }
  }, [contextReady, buildHeaders]);

  // ── Disconnect ──
  const disconnect = useCallback(async () => {
    setPending(true);
    try {
      const res = await fetch('/api/integrations/zoho/disconnect', {
        method: 'POST',
        headers: buildHeaders(),
        cache: 'no-store',
      });
      const body = (await res.json().catch(() => ({}))) as DisconnectResponse;
      if (!res.ok || !body.ok) {
        return { error: body.error ?? 'Failed to disconnect Zoho.' };
      }
      // Optimistically update local status + re-fetch authoritative status.
      setStatus(UNKNOWN_STATUS);
      void refreshStatus();
      return { error: null };
    } catch (e) {
      return { error: (e as Error).message };
    } finally {
      setPending(false);
    }
  }, [buildHeaders, refreshStatus]);

  // ── Force refresh ──
  const refresh = useCallback(async () => {
    setPending(true);
    try {
      const res = await fetch('/api/integrations/zoho/refresh', {
        method: 'POST',
        headers: buildHeaders(),
        cache: 'no-store',
      });
      const body = (await res.json().catch(() => ({}))) as RefreshResponse;
      if (!res.ok || !body.ok) {
        return { error: body.error ?? 'Failed to refresh Zoho token.' };
      }
      if (body.status) setStatus(body.status);
      else void refreshStatus();
      return { error: null };
    } catch (e) {
      return { error: (e as Error).message };
    } finally {
      setPending(false);
    }
  }, [buildHeaders, refreshStatus]);

  // ── Generic authenticated fetch ──
  const call = useCallback(
    async <T = unknown>(
      path: string,
      init?: RequestInit
    ): Promise<{ data: T | null; error: string | null; code: string | null }> => {
      if (!contextReady) {
        return {
          data: null,
          error: 'Loading workspace… please wait.',
          code: 'NO_CONTEXT',
        };
      }
      try {
        const res = await fetch(path, {
          ...init,
          headers: {
            ...buildHeaders(),
            ...((init?.headers as Record<string, string>) ?? {}),
          },
          cache: 'no-store',
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok: boolean;
          data?: T;
          error?: string;
          code?: string;
        };
        if (!res.ok || !body.ok) {
          return {
            data: null,
            error: body.error ?? `Request failed (HTTP ${res.status}).`,
            code: body.code ?? `http_${res.status}`,
          };
        }
        return { data: body.data ?? null, error: null, code: null };
      } catch (e) {
        return {
          data: null,
          error: (e as Error).message,
          code: 'network_error',
        };
      }
    },
    [contextReady, buildHeaders]
  );

  // ── Convenience wrappers ──
  const listOrganizations = useCallback(async () => {
    const r = await call<{
      organizations: ZohoOrganization[];
      selectedOrgId: string | null;
      count: number;
    }>('/api/integrations/zoho/organizations');
    if (r.error) {
      return { data: null, selectedOrgId: null, error: r.error };
    }
    const data = r.data ?? null;
    return {
      data: data?.organizations ?? [],
      selectedOrgId: data?.selectedOrgId ?? null,
      error: null,
    };
  }, [call]);

  const selectOrganization = useCallback(
    async (orgId: string, orgName?: string) => {
      const r = await call('/api/integrations/zoho/organizations/select', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: orgId,
          organizationName: orgName ?? null,
        }),
      });
      return { error: r.error };
    },
    [call]
  );

  const listCustomers = useCallback(
    async (max = 25) => {
      const r = await call<{ contacts: ZohoContact[] }>(
        `/api/integrations/zoho/customers?max=${max}`
      );
      if (r.error) return { data: null, error: r.error };
      const data = r.data ?? null;
      return { data: data?.contacts ?? [], error: null };
    },
    [call]
  );

  const listInvoices = useCallback(
    async (max = 25) => {
      const r = await call<{ invoices: ZohoInvoice[] }>(
        `/api/integrations/zoho/invoices?max=${max}`
      );
      if (r.error) return { data: null, error: r.error };
      const data = r.data ?? null;
      return { data: data?.invoices ?? [], error: null };
    },
    [call]
  );

  const listBills = useCallback(
    async (max = 25) => {
      const r = await call<{ bills: ZohoBill[] }>(
        `/api/integrations/zoho/bills?max=${max}`
      );
      if (r.error) return { data: null, error: r.error };
      const data = r.data ?? null;
      return { data: data?.bills ?? [], error: null };
    },
    [call]
  );

  const listPayments = useCallback(
    async (max = 25) => {
      const r = await call<{ payments: ZohoPayment[] }>(
        `/api/integrations/zoho/payments?max=${max}`
      );
      if (r.error) return { data: null, error: r.error };
      const data = r.data ?? null;
      return { data: data?.payments ?? [], error: null };
    },
    [call]
  );

  return {
    status,
    statusLoading,
    statusError,
    refreshStatus,
    contextReady,
    connect,
    disconnect,
    refresh,
    pending,
    listOrganizations,
    selectOrganization,
    listCustomers,
    listInvoices,
    listBills,
    listPayments,
  };
}
