'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — Google Workspace Integration Page
// ═══════════════════════════════════════════════════════════════════════════════
// Full Google Workspace integration UI:
//
//   • Status banner — connected (live) / stale / disconnected / error.
//   • When disconnected: Connect button (disabled until contextReady).
//   • When connected: shows the connected email, last sync, scopes, and a
//     Disconnect button. Below that, Gmail / Drive / Calendar tabs backed by
//     REAL Google API responses (no mock data).
//   • Uses the existing dark theme (bg-black + text-white + white/[0.04]
//     surfaces) consistent with every other VEYRO page.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  Unplug,
  Calendar as CalendarIcon,
  HardDrive,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useGoogleWorkspace } from '@/hooks/useGoogleWorkspace';
import type {
  CalendarEvent,
  DriveFile,
  GmailMessage,
  GmailProfile,
} from '@/hooks/useGoogleWorkspace';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatScope(scope: string | null): string[] {
  if (!scope) return [];
  return scope
    .split(' ')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^https?:\/\/www\.googleapis\.com\/auth\//, ''));
}

function formatGmailDate(internalDate?: string): string {
  if (!internalDate) return '—';
  const ms = Number(internalDate);
  if (!Number.isFinite(ms)) return '—';
  return formatDate(new Date(ms).toISOString());
}

function getHeader(
  msg: GmailMessage | undefined,
  name: string
): string {
  const headers = msg?.payload?.headers ?? [];
  const found = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  return found?.value ?? '—';
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ state }: { state: 'live' | 'stale' | 'disconnected' | 'unknown' }) {
  const map: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    live: {
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
      label: 'Live',
      className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    },
    stale: {
      icon: <Clock className="h-3.5 w-3.5 text-amber-400" />,
      label: 'Stale',
      className: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    },
    disconnected: {
      icon: <Unplug className="h-3.5 w-3.5 text-white/40" />,
      label: 'Disconnected',
      className: 'border-white/10 bg-white/[0.04] text-white/50',
    },
    unknown: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />,
      label: 'Checking…',
      className: 'border-white/10 bg-white/[0.04] text-white/50',
    },
  };
  const s = map[state] ?? map.unknown;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${s.className}`}
    >
      {s.icon}
      {s.label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function GoogleWorkspacePage() {
  const {
    status,
    statusLoading,
    statusError,
    refreshStatus,
    contextReady,
    connect,
    disconnect,
    pending,
    gmailProfile,
    gmailMessages,
    driveFiles,
    calendarEvents,
  } = useGoogleWorkspace();

  const [connectError, setConnectError] = useState<string | null>(null);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setConnectError(null);
    const { authUrl, error, notConfigured } = await connect();
    if (authUrl) {
      window.location.href = authUrl;
      return;
    }
    setConnectError(
      error ??
        (notConfigured
          ? 'Google Workspace OAuth is not configured on this server.'
          : 'Could not start the Google connect flow.')
    );
  }, [connect]);

  const handleDisconnect = useCallback(async () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        'Disconnect Google Workspace? You will need to re-connect to use Gmail, Drive, and Calendar again.'
      )
    ) {
      return;
    }
    setDisconnectError(null);
    const { error } = await disconnect();
    if (error) setDisconnectError(error);
  }, [disconnect]);

  // Detect ?google_connected=1 / ?google_error= on mount and refresh status.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const connected = url.searchParams.get('google_connected');
    const err = url.searchParams.get('google_error');
    if (connected === '1' || err) {
      void refreshStatus();
      // Clean the URL so the flag doesn't linger on refresh.
      url.searchParams.delete('google_connected');
      url.searchParams.delete('google_error');
      window.history.replaceState({}, '', url.toString());
    }
  }, [refreshStatus]);

  const isConnected = status?.connected === true && status.state !== 'disconnected';
  const isStale = status?.state === 'stale';

  // ── Loading shell ─────────────────────────────────────────────────────────
  if (statusLoading && !status) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-black px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          <p className="text-sm text-white/50">Loading Google Workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-black px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <Mail className="h-5 w-5 text-white/70" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                Google Workspace
              </h1>
              <p className="mt-0.5 text-sm text-white/50">
                Connect Gmail, Drive &amp; Calendar to VEYRO.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refreshStatus()}
              disabled={statusLoading || !contextReady}
              className="text-white/60 hover:bg-white/[0.06] hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${statusLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {isConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={pending}
                className="border-white/10 bg-transparent text-white/70 hover:bg-white/[0.06] hover:text-white"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={!contextReady || pending}
                className="bg-white text-black hover:bg-white/90"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {contextReady ? 'Connect Google' : 'Loading workspace…'}
              </Button>
            )}
          </div>
        </header>

        {/* ── Context-not-ready banner ────────────────────────────────────── */}
        {!contextReady && (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin text-white/40" />
            Resolving your workspace context — the Connect button is disabled
            until your organization is loaded.
          </div>
        )}

        {/* ── Connect error ───────────────────────────────────────────────── */}
        {connectError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">{connectError}</div>
            <button
              type="button"
              onClick={() => setConnectError(null)}
              className="text-red-300/60 hover:text-red-200"
              aria-label="Dismiss"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Disconnect error ────────────────────────────────────────────── */}
        {disconnectError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">{disconnectError}</div>
            <button
              type="button"
              onClick={() => setDisconnectError(null)}
              className="text-red-300/60 hover:text-red-200"
              aria-label="Dismiss"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Status load error ──────────────────────────────────────────── */}
        {statusError && !status && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">{statusError}</div>
          </div>
        )}

        {/* ── Disconnected card ──────────────────────────────────────────── */}
        {!isConnected && (
          <DisconnectedCard
            contextReady={contextReady}
            pending={pending}
            onConnect={handleConnect}
          />
        )}

        {/* ── Connected: status + scopes + tabs ──────────────────────────── */}
        {isConnected && status && (
          <ConnectedPanel
            status={status}
            isStale={isStale}
            gmailProfile={gmailProfile}
            gmailMessages={gmailMessages}
            driveFiles={driveFiles}
            calendarEvents={calendarEvents}
          />
        )}
      </div>
    </div>
  );
}

// ── Disconnected card ──────────────────────────────────────────────────────────

function DisconnectedCard({
  contextReady,
  pending,
  onConnect,
}: {
  contextReady: boolean;
  pending: boolean;
  onConnect: () => void;
}) {
  return (
    <section className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
        <Mail className="h-8 w-8 text-white/40" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-lg font-semibold">Connect to Google Workspace</h2>
        <p className="max-w-md text-sm text-white/50">
          Authorize VEYRO to read your Gmail inbox, list Drive files, and
          show upcoming Calendar events. You can disconnect at any time — tokens
          are encrypted and stored server-side only.
        </p>
      </div>
      <Button
        size="lg"
        onClick={onConnect}
        disabled={!contextReady || pending}
        className="bg-white text-black hover:bg-white/90"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {contextReady ? 'Connect Google Workspace' : 'Loading workspace…'}
      </Button>
      <p className="text-xs text-white/30">
        Scopes requested: Gmail (send + read + compose), Drive (app-created
        files), Docs, Sheets, Calendar.
      </p>
    </section>
  );
}

// ── Connected panel ────────────────────────────────────────────────────────────

function ConnectedPanel({
  status,
  isStale,
  gmailProfile,
  gmailMessages,
  driveFiles,
  calendarEvents,
}: {
  status: ReturnType<typeof useGoogleWorkspace>['status'] & {};
  isStale: boolean;
  gmailProfile: () => Promise<{ data: GmailProfile | null; error: string | null }>;
  gmailMessages: (max?: number) => Promise<{ data: GmailMessage[] | null; error: string | null }>;
  driveFiles: () => Promise<{ data: DriveFile[] | null; error: string | null }>;
  calendarEvents: (max?: number) => Promise<{ data: CalendarEvent[] | null; error: string | null }>;
}) {
  const scopes = formatScope(status.scope);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Status card ────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill state={status.state} />
          {isStale && (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              Temporary issue reaching Google — try refreshing.
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Connected email" value={status.email ?? '—'} mono />
          <Field label="Last sync" value={formatDate(status.updatedAt)} />
          <Field label="Connected since" value={formatDate(status.connectedAt)} />
        </div>

        {scopes.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-white/40">
              Authorized scopes
            </p>
            <div className="flex flex-wrap gap-1.5">
              {scopes.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-white/60"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="gmail" className="gap-4">
        <TabsList className="bg-white/[0.04] text-white/60">
          <TabsTrigger value="gmail" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
            <Mail className="h-3.5 w-3.5" />
            Gmail
          </TabsTrigger>
          <TabsTrigger value="drive" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
            <HardDrive className="h-3.5 w-3.5" />
            Drive
          </TabsTrigger>
          <TabsTrigger value="calendar" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
            <CalendarIcon className="h-3.5 w-3.5" />
            Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gmail">
          <GmailTab
            gmailProfile={gmailProfile}
            gmailMessages={gmailMessages}
          />
        </TabsContent>
        <TabsContent value="drive">
          <DriveTab driveFiles={driveFiles} />
        </TabsContent>
        <TabsContent value="calendar">
          <CalendarTab calendarEvents={calendarEvents} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-white/40">
        {label}
      </span>
      <span className={`text-sm text-white/80 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

// ── Gmail tab ─────────────────────────────────────────────────────────────────

function GmailTab({
  gmailProfile,
  gmailMessages,
}: {
  gmailProfile: () => Promise<{ data: GmailProfile | null; error: string | null }>;
  gmailMessages: (max?: number) => Promise<{ data: GmailMessage[] | null; error: string | null }>;
}) {
  const [profile, setProfile] = useState<GmailProfile | null>(null);
  const [messages, setMessages] = useState<GmailMessage[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, mRes] = await Promise.all([gmailProfile(), gmailMessages(10)]);
      if (pRes.error || mRes.error) {
        setError(pRes.error ?? mRes.error ?? 'Failed to load Gmail data.');
      }
      setProfile(pRes.data);
      setMessages(mRes.data);
    } finally {
      setLoading(false);
    }
  }, [gmailProfile, gmailMessages]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !profile && !messages) {
    return <TabLoading label="Loading Gmail…" />;
  }
  if (error && !profile && !messages) {
    return <TabError message={error} onRetry={load} />;
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
      {profile && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Email" value={profile.emailAddress ?? '—'} mono />
          <Field
            label="Total messages"
            value={
              profile.messagesTotal != null
                ? profile.messagesTotal.toLocaleString()
                : '—'
            }
          />
          <Field
            label="Total threads"
            value={
              profile.threadsTotal != null
                ? profile.threadsTotal.toLocaleString()
                : '—'
            }
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/80">Recent messages</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="text-white/60 hover:bg-white/[0.06] hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            {error}
          </div>
        )}

        {messages && messages.length === 0 && (
          <p className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/50">
            No recent messages found.
          </p>
        )}

        {messages && messages.length > 0 && (
          <ul className="max-h-96 divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] [scrollbar-width:thin]">
            {messages.map((m) => {
              const from = getHeader(m, 'From');
              const subject = getHeader(m, 'Subject');
              return (
                <li
                  key={m.id}
                  className="flex flex-col gap-0.5 px-4 py-3 hover:bg-white/[0.03]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm text-white/80">{from}</span>
                    <span className="shrink-0 text-xs text-white/40">
                      {formatGmailDate(m.internalDate)}
                    </span>
                  </div>
                  <span className="truncate text-sm text-white/60">
                    {subject === '—' ? '(no subject)' : subject}
                  </span>
                  {m.snippet && (
                    <span className="line-clamp-1 text-xs text-white/40">{m.snippet}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// ── Drive tab ──────────────────────────────────────────────────────────────────

function DriveTab({
  driveFiles,
}: {
  driveFiles: () => Promise<{ data: DriveFile[] | null; error: string | null }>;
}) {
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await driveFiles();
      if (error) setError(error);
      setFiles(data);
    } finally {
      setLoading(false);
    }
  }, [driveFiles]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !files) return <TabLoading label="Loading Drive files…" />;
  if (error && !files) return <TabError message={error} onRetry={load} />;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">
          Files created or opened by VEYRO
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="text-white/60 hover:bg-white/[0.06] hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {error}
        </div>
      )}

      {files && files.length === 0 && (
        <p className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/50">
          No Drive files yet. Documents created by VEYRO will appear here.
        </p>
      )}

      {files && files.length > 0 && (
        <ul className="max-h-96 divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] [scrollbar-width:thin]">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03]">
              <FileText className="h-4 w-4 shrink-0 text-white/40" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm text-white/80">{f.name ?? 'Untitled'}</span>
                <span className="truncate text-xs text-white/40">{f.mimeType ?? 'file'}</span>
              </div>
              <span className="shrink-0 text-xs text-white/40">
                {formatDate(f.modifiedTime ?? null)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Calendar tab ───────────────────────────────────────────────────────────────

function CalendarTab({
  calendarEvents,
}: {
  calendarEvents: (max?: number) => Promise<{ data: CalendarEvent[] | null; error: string | null }>;
}) {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await calendarEvents(10);
      if (error) setError(error);
      setEvents(data);
    } finally {
      setLoading(false);
    }
  }, [calendarEvents]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !events) return <TabLoading label="Loading Calendar events…" />;
  if (error && !events) return <TabError message={error} onRetry={load} />;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">Upcoming events</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="text-white/60 hover:bg-white/[0.06] hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {error}
        </div>
      )}

      {events && events.length === 0 && (
        <p className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/50">
          No upcoming events on your primary calendar.
        </p>
      )}

      {events && events.length > 0 && (
        <ul className="max-h-96 divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] [scrollbar-width:thin]">
          {events.map((e) => {
            const start = e.start?.dateTime ?? e.start?.date ?? null;
            return (
              <li key={e.id} className="flex flex-col gap-0.5 px-4 py-3 hover:bg-white/[0.03]">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm text-white/80">
                    {e.summary ?? '(no title)'}
                  </span>
                  <span className="shrink-0 text-xs text-white/40">
                    {formatDate(start)}
                  </span>
                </div>
                {e.location && (
                  <span className="truncate text-xs text-white/40">📍 {e.location}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── Shared tab states ──────────────────────────────────────────────────────────

function TabLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-12 text-sm text-white/50">
      <Loader2 className="h-4 w-4 animate-spin text-white/40" />
      {label}
    </div>
  );
}

function TabError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 px-6 py-10 text-center">
      <AlertTriangle className="h-5 w-5 text-red-400" />
      <p className="text-sm text-red-300">{message}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="border-white/10 bg-transparent text-white/70 hover:bg-white/[0.06] hover:text-white"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </Button>
    </div>
  );
}

export default GoogleWorkspacePage;
