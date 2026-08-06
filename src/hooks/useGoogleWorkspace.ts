'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useGoogleWorkspace Hook
//
// Client-side data + actions layer for the Google Workspace integration.
// Wraps every fetch with the org+user context headers (x-gstpilot-orgid +
// x-gstpilot-actor) so the server routes can resolve + refresh the encrypted
// OAuth tokens. Exposes typed action wrappers for Gmail / Drive / Docs /
// Sheets / Calendar.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GoogleConnectionStatus {
  connected: boolean;
  userEmail: string | null;
  googleUserId: string | null;
  connectedAt: string | null;
  scopes: string[];
}

interface ApiError {
  error: string;
}

// ─── Header builder ──────────────────────────────────────────────────────────

function useGoogleHeaders() {
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

// ─── Fetch helpers ───────────────────────────────────────────────────────────

async function gfetch<T>(
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

export function useGoogleWorkspace() {
  const buildHeaders = useGoogleHeaders();
  const { organization } = useOrg();
  const { user } = useAuth();

  const [status, setStatus] = useState<GoogleConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const orgId = organization?.id ?? null;
  const userId = user?.id ?? null;

  // ── Refresh the connection status ──
  // Skip until BOTH orgId + userId are present. Calling /status with an
  // empty actor.uid would force the route to return its
  // `requiresAuth: true` placeholder forever (the user never "logs in"),
  // which the UI would misread as "credentials not configured".
  const refreshStatus = useCallback(async () => {
    if (!orgId || !userId) return;
    setStatusLoading(true);
    setStatusError(null);
    const res = await gfetch<{ ok: boolean; status: GoogleConnectionStatus }>(
      '/api/integrations/google/status',
      buildHeaders(),
    );
    if (res.ok && res.data) {
      setStatus(res.data.status);
    } else {
      setStatusError(res.error);
    }
    setStatusLoading(false);
  }, [orgId, userId, buildHeaders]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshStatus();
  }, [refreshStatus]);

  // ── OAuth connect — returns the consent URL for the client to redirect to ──
  const connect = useCallback(async (): Promise<{ authUrl: string | null; error: string | null }> => {
    // Attach the Firebase ID token if available so the server can verify it.
    let bearer = '';
    try {
      if (auth.currentUser) bearer = await auth.currentUser.getIdToken();
    } catch {
      /* ignore — preview mode */
    }
    const headers = buildHeaders(bearer ? { Authorization: `Bearer ${bearer}` } : {});
    const res = await gfetch<{ ok: boolean; authUrl: string }>(
      '/api/integrations/google/connect?return=/google-workspace',
      headers,
    );
    return { authUrl: res.data?.authUrl ?? null, error: res.error };
  }, [buildHeaders]);

  // ── Disconnect ──
  const disconnect = useCallback(async (): Promise<{ error: string | null }> => {
    setPending(true);
    const res = await gfetch<{ ok: boolean }>(
      '/api/integrations/google/disconnect',
      buildHeaders(),
      { method: 'POST' },
    );
    setPending(false);
    if (!res.error) await refreshStatus();
    return { error: res.error };
  }, [buildHeaders, refreshStatus]);

  // ── Generic action caller ──
  const call = useCallback(
    async <T>(path: string, init?: RequestInit): Promise<{ ok: boolean; data: T | null; error: string | null }> => {
      setPending(true);
      const res = await gfetch<T>(path, buildHeaders(), init);
      setPending(false);
      return res;
    },
    [buildHeaders],
  );

  // ── Gmail ──
  const gmailProfile = useCallback(
    () => call<{ ok: boolean; profile: unknown }>('/api/integrations/google/gmail?action=profile'),
    [call],
  );
  const gmailMessages = useCallback(
    (max = 20) =>
      call<{ ok: boolean; messages: unknown[] }>(`/api/integrations/google/gmail?action=messages&max=${max}`),
    [call],
  );
  const gmailSend = useCallback(
    (input: { to: string; subject: string; body: string; cc?: string; bcc?: string; isHtml?: boolean }) =>
      call<{ ok: boolean; message: unknown }>('/api/integrations/google/gmail?action=send', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    [call],
  );
  const gmailDraft = useCallback(
    (input: { to: string; subject: string; body: string; isHtml?: boolean }) =>
      call<{ ok: boolean; draft: unknown }>('/api/integrations/google/gmail?action=draft', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    [call],
  );

  // ── Drive ──
  const driveFiles = useCallback(
    (parentId?: string) =>
      call<{ ok: boolean; files: unknown[] }>(
        `/api/integrations/google/drive${parentId ? `?parentId=${encodeURIComponent(parentId)}` : ''}`,
      ),
    [call],
  );
  const driveFolder = useCallback(
    (name: string, parentId?: string) =>
      call<{ ok: boolean; file: unknown }>('/api/integrations/google/drive?action=folder', {
        method: 'POST',
        body: JSON.stringify({ name, parentId }),
      }),
    [call],
  );
  const driveUpload = useCallback(
    (input: { name: string; mimeType: string; contentBase64: string; parentId?: string }) =>
      call<{ ok: boolean; file: unknown }>('/api/integrations/google/drive?action=upload', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    [call],
  );

  // ── Docs ──
  const docsCreate = useCallback(
    (input: { title: string; paragraphs?: Array<{ text: string; heading?: string }> }) =>
      call<{ ok: boolean; document: unknown }>('/api/integrations/google/docs?action=create', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    [call],
  );

  // ── Sheets ──
  const sheetsExport = useCallback(
    (input: { title: string; rows: Array<{ values: string[] }>; sheetName?: string }) =>
      call<{ ok: boolean; spreadsheet: unknown }>('/api/integrations/google/sheets?action=export', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    [call],
  );

  // ── Calendar ──
  const calendarEvents = useCallback(
    (max = 20) =>
      call<{ ok: boolean; events: unknown[] }>(`/api/integrations/google/calendar/events?max=${max}`),
    [call],
  );
  const calendarCreate = useCallback(
    (input: {
      summary: string;
      description?: string;
      start: string;
      end: string;
      attendees?: string[];
      location?: string;
      reminders?: Array<{ minutes: number; method?: string }>;
    }) =>
      call<{ ok: boolean; event: unknown }>('/api/integrations/google/calendar/events', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    [call],
  );

  return {
    // status
    status,
    statusLoading,
    statusError,
    refreshStatus,
    // oauth
    connect,
    disconnect,
    // generic
    pending,
    call,
    // gmail
    gmailProfile,
    gmailMessages,
    gmailSend,
    gmailDraft,
    // drive
    driveFiles,
    driveFolder,
    driveUpload,
    // docs
    docsCreate,
    // sheets
    sheetsExport,
    // calendar
    calendarEvents,
    calendarCreate,
  };
}
