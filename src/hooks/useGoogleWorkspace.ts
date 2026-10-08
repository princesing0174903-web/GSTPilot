'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — useGoogleWorkspace() Hook
// ═══════════════════════════════════════════════════════════════════════════════
// Client-side hook for the Google Workspace integration.
//
// • Stamps every API request with `x-gstpilot-orgid` + `x-gstpilot-actor`
//   headers (mirrors `useConnectedSources` + `useZohoBooks`).
// • `contextReady` is `true` ONLY when both org + user are resolved. The
//   Connect button stays disabled until this flips, so we never send a
//   request with empty headers (which the routes correctly reject with 400).
// • `connect()` returns the OAuth consent URL — the caller (GoogleWorkspacePage)
//   redirects the browser to it.
// • `call<T>()` is a generic authenticated fetch wrapper for the proxied
//   Google API routes (Gmail / Drive / Calendar).
// • Convenience wrappers: `gmailProfile()`, `gmailMessages(max)`,
//   `driveFiles()`, `calendarEvents(max)`.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { useOrgUserHeaders } from '@/hooks/useOrgUserHeaders';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GoogleStatus {
  connected: boolean;
  state: 'live' | 'stale' | 'disconnected' | 'unknown';
  email: string | null;
  googleUserId: string | null;
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
  status?: GoogleStatus;
  error?: string;
  code?: string;
}

interface DisconnectResponse {
  ok: boolean;
  error?: string;
}

export interface GmailProfile {
  emailAddress?: string;
  messagesTotal?: number;
  threadsTotal?: number;
  historyId?: string;
}

export interface GmailMessage {
  id: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: { name: string; value: string }[];
  };
  labelIds?: string[];
}

export interface DriveFile {
  id: string;
  name?: string;
  mimeType?: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
}

export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  htmlLink?: string;
  status?: string;
}

export interface UseGoogleWorkspaceResult {
  // ── Status ──
  status: GoogleStatus | null;
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
  pending: boolean;

  // ── Generic authenticated fetch ──
  call: <T = unknown>(path: string, init?: RequestInit) => Promise<{ data: T | null; error: string | null; code: string | null }>;

  // ── Convenience wrappers ──
  gmailProfile: () => Promise<{ data: GmailProfile | null; error: string | null }>;
  gmailMessages: (max?: number) => Promise<{ data: GmailMessage[] | null; error: string | null }>;
  driveFiles: () => Promise<{ data: DriveFile[] | null; error: string | null }>;
  calendarEvents: (max?: number) => Promise<{ data: CalendarEvent[] | null; error: string | null }>;
}

// ── Initial state ─────────────────────────────────────────────────────────────

const UNKNOWN_STATUS: GoogleStatus = {
  connected: false,
  state: 'unknown',
  email: null,
  googleUserId: null,
  connectedAt: null,
  updatedAt: null,
  expiryDate: null,
  scope: null,
  error: null,
  permanent: false,
};

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useGoogleWorkspace(): UseGoogleWorkspaceResult {
  const buildHeadersCtx = useOrgUserHeaders();
  const contextReady = buildHeadersCtx().contextReady;

  const [status, setStatus] = useState<GoogleStatus | null>(null);
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
      const res = await fetch('/api/integrations/google/status', {
        headers: buildHeaders(),
        cache: 'no-store',
      });
      const body = (await res.json().catch(() => ({}))) as StatusResponse;
      if (!res.ok || !body.ok || !body.status) {
        setStatus(UNKNOWN_STATUS);
        setStatusError(body?.error ?? 'Failed to load Google status.');
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
    // We intentionally only re-fire when contextReady flips to true —
    // refreshStatus depends on stable identity via useCallback.
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
      const res = await fetch('/api/integrations/google/connect', {
        headers: buildHeaders(),
        cache: 'no-store',
      });
      const body = (await res.json().catch(() => ({}))) as ConnectResponse;
      if (!res.ok || !body.ok || !body.authUrl) {
        const notConfigured = body.code === 'GOOGLE_NOT_CONFIGURED';
        return {
          authUrl: null,
          error:
            body.error ??
            (notConfigured
              ? 'Google Workspace is not configured on this server.'
              : 'Failed to start Google connect.'),
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
      const res = await fetch('/api/integrations/google/disconnect', {
        method: 'POST',
        headers: buildHeaders(),
        cache: 'no-store',
      });
      const body = (await res.json().catch(() => ({}))) as DisconnectResponse;
      if (!res.ok || !body.ok) {
        return { error: body.error ?? 'Failed to disconnect Google.' };
      }
      // Optimistically update local status.
      setStatus(UNKNOWN_STATUS);
      // Re-fetch authoritative status.
      void refreshStatus();
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
  const gmailProfile = useCallback(async () => {
    const r = await call<{ profile?: GmailProfile } | GmailProfile>(
      '/api/integrations/google/gmail?action=profile'
    );
    if (r.error) return { data: null, error: r.error };
    const data = (r.data as GmailProfile | { profile?: GmailProfile }) ?? null;
    const profile = data && 'profile' in data ? data.profile : (data as GmailProfile);
    return { data: profile ?? null, error: null };
  }, [call]);

  const gmailMessages = useCallback(
    async (max = 10) => {
      const r = await call<{ messages: GmailMessage[] } | { messages?: GmailMessage[] }>(
        `/api/integrations/google/gmail?action=messages&max=${max}`
      );
      if (r.error) return { data: null, error: r.error };
      const data = r.data ?? null;
      const messages =
        data && 'messages' in data ? (data.messages ?? []) : (data as unknown as GmailMessage[]);
      return { data: messages, error: null };
    },
    [call]
  );

  const driveFiles = useCallback(async () => {
    const r = await call<{ files: DriveFile[] } | { files?: DriveFile[] }>(
      '/api/integrations/google/drive?max=25'
    );
    if (r.error) return { data: null, error: r.error };
    const data = r.data ?? null;
    const files = data && 'files' in data ? (data.files ?? []) : [];
    return { data: files, error: null };
  }, [call]);

  const calendarEvents = useCallback(
    async (max = 10) => {
      const r = await call<{ events: CalendarEvent[] } | { events?: CalendarEvent[] }>(
        `/api/integrations/google/calendar/events?max=${max}`
      );
      if (r.error) return { data: null, error: r.error };
      const data = r.data ?? null;
      const events = data && 'events' in data ? (data.events ?? []) : [];
      return { data: events, error: null };
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
    pending,
    call,
    gmailProfile,
    gmailMessages,
    driveFiles,
    calendarEvents,
  };
}
