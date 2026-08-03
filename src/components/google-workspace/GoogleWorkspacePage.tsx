'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Google Workspace Enterprise Integration Page
//
// A premium integration console with:
//   • Connection header (connect / disconnect / status)
//   • 5 service tabs: Gmail · Drive · Docs · Sheets · Calendar
//   • Each tab exposes the key actions for that service (real API calls,
//     no mock data). Results render inline with loading + error states.
//
// OAuth flow: clicking "Connect" fetches the consent URL from
// /api/integrations/google/connect and redirects the browser there. Google
// returns to /api/integrations/google/callback which persists the encrypted
// tokens and redirects back here with ?google_connected=1.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, HardDrive, FileText, Table, Calendar,
  CheckCircle2, XCircle, Loader2, RefreshCw, Plug, Unplug,
  Send, FolderPlus, Upload, FilePlus, Download, CalendarPlus,
  ExternalLink, AlertCircle, ShieldCheck, Clock,
  Zap, ArrowUpRight, Inbox, Paperclip, Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useGoogleWorkspace } from '@/hooks/useGoogleWorkspace';
import { useOrg } from '@/contexts/OrgContext';

type ServiceTab = 'gmail' | 'drive' | 'docs' | 'sheets' | 'calendar';

interface ActionResult {
  ok: boolean;
  message: string;
  data?: unknown;
}

// ─── Connection Header ───────────────────────────────────────────────────────

function ConnectionHeader() {
  const { status, statusLoading, connect, disconnect, pending, refreshStatus } = useGoogleWorkspace();
  const [connectError, setConnectError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setConnectError(null);
    const { authUrl, error } = await connect();
    if (error) {
      setConnectError(error);
      return;
    }
    if (authUrl) {
      window.location.href = authUrl;
    }
  }, [connect]);

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const handleDisconnect = useCallback(() => {
    setConfirmDialogOpen(true);
  }, []);

  const confirmDisconnect = useCallback(async () => {
    setConfirmDialogOpen(false);
    const { error } = await disconnect();
    if (error) setConnectError(error);
  }, [disconnect]);

  return (
    <>
    <Card className="border-border/60 bg-card/50 backdrop-blur">
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/[0.08]">
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">Google Workspace</h2>
              {statusLoading ? (
                <Badge variant="outline" className="border-border/60 text-muted-foreground">
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Checking…
                </Badge>
              ) : status?.connected ? (
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="border-border/60 text-muted-foreground">
                  <XCircle className="mr-1 h-3 w-3" /> Not connected
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {status?.connected
                ? `Connected as ${status.userEmail ?? 'unknown'}`
                : 'Connect your Google account to enable Gmail, Drive, Docs, Sheets, and Calendar.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void refreshStatus()}
            disabled={statusLoading}
            className="h-8 gap-1.5 text-muted-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          {status?.connected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={pending}
              className="h-8 gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
              Disconnect
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={pending}
              className="h-8 gap-1.5 bg-[#4285F4] text-white hover:bg-[#3367d6]"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
              Connect Google
            </Button>
          )}
        </div>
        {connectError ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {connectError}
          </div>
        ) : null}
        {status?.connected && status.scopes.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Scopes:</span>
            {['Gmail', 'Drive', 'Docs', 'Sheets', 'Calendar'].map((s) => (
              <Badge key={s} variant="outline" className="h-5 px-1.5 text-[9px] font-medium text-muted-foreground">
                {s}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
    <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect Google Workspace?</AlertDialogTitle>
          <AlertDialogDescription>
            Live data from Gmail, Drive, and Calendar will stop syncing. You can reconnect anytime.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmDisconnect}
            className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
          >
            Disconnect
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

// ─── Not-connected gate ──────────────────────────────────────────────────────

function NotConnectedGate({ children }: { children: React.ReactNode }) {
  const { status, statusLoading } = useGoogleWorkspace();
  if (statusLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }
  if (!status?.connected) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center gap-5 rounded-2xl border border-border/60 bg-card/50 p-8 text-center shadow-sm backdrop-blur">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
            <Plug className="h-7 w-7 text-amber-500" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold tracking-tight">Connect Google Workspace</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This tab requires a connected Google account. Click <span className="font-medium text-foreground">Connect Google</span> above to grant access to Gmail, Drive, Docs, Sheets, and Calendar.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Never';
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return d.toLocaleDateString();
}

// ─── Sync Status Pill ────────────────────────────────────────────────────────
//
// Three states mirror the spec:
//   • Connected  → emerald pill with check icon
//   • Syncing... → blue pill with breathing dot animation (CSS animate-pulse
//                  on a small dot, plus Loader2 spinner for clarity)
//   • Not connected → amber pill with x icon
//
// `syncing` is true while ANY Google Workspace action is in flight
// (useGoogleWorkspace.pending).

function SyncStatusPill({
  connected,
  syncing,
}: {
  connected: boolean;
  syncing: boolean;
}) {
  if (syncing) {
    return (
      <Badge
        variant="outline"
        className="border-blue-500/30 bg-blue-500/10 text-blue-400"
      >
        <span className="mr-1.5 inline-flex h-2 w-2 items-center justify-center">
          <span className="absolute h-2 w-2 animate-ping rounded-full bg-blue-400/70" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-blue-400" />
        </span>
        Syncing…
      </Badge>
    );
  }
  if (connected) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      >
        <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400">
      <XCircle className="mr-1 h-3 w-3" /> Not connected
    </Badge>
  );
}

// ─── Recent Activity ─────────────────────────────────────────────────────────
//
// Pulls the 5 most recent items across Gmail / Drive / Calendar and renders
// them as a unified activity feed. Each item is tagged with its source so the
// icon + label make sense to the user.
//
// IMPORTANT: no faked data. If the user has just connected and the API
// returns empty arrays (or errors), we show an honest empty state asking them
// to sync now to populate the feed.

type ActivityKind = 'email' | 'file' | 'event';
interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  subtitle: string;
  timestamp: number | null; // epoch ms
  link?: string;
}

function deriveEmailActivity(m: Record<string, unknown>): ActivityItem | null {
  const headers = (m.payload as { headers?: Array<{ name: string; value: string }> } | undefined)?.headers ?? [];
  const from = headers.find((h) => h.name === 'From')?.value ?? 'Unknown sender';
  const subj = headers.find((h) => h.name === 'Subject')?.value ?? '(no subject)';
  const ts = m.internalDate ? Number(m.internalDate) : null;
  return {
    id: `email-${String(m.id ?? '')}`,
    kind: 'email',
    title: subj,
    subtitle: from,
    timestamp: ts,
  };
}

function deriveFileActivity(f: Record<string, unknown>): ActivityItem | null {
  const ts = f.modifiedTime ? new Date(String(f.modifiedTime)).getTime() : null;
  return {
    id: `file-${String(f.id ?? '')}`,
    kind: 'file',
    title: String(f.name ?? 'Untitled file'),
    subtitle: String(f.mimeType ?? 'file'),
    timestamp: ts,
    link: typeof f.webViewLink === 'string' ? f.webViewLink : undefined,
  };
}

function deriveEventActivity(e: Record<string, unknown>): ActivityItem | null {
  const startObj = e.start as { dateTime?: string; date?: string } | undefined;
  const startStr = startObj?.dateTime ?? startObj?.date ?? '';
  const ts = startStr ? new Date(startStr).getTime() : null;
  return {
    id: `event-${String(e.id ?? '')}`,
    kind: 'event',
    title: String(e.summary ?? '(no title)'),
    subtitle: startStr ? new Date(startStr).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—',
    timestamp: ts,
    link: typeof e.htmlLink === 'string' ? e.htmlLink : undefined,
  };
}

function activityIcon(kind: ActivityKind) {
  if (kind === 'email') return <Inbox className="h-3.5 w-3.5 text-[#4285F4]" />;
  if (kind === 'file') return <Paperclip className="h-3.5 w-3.5 text-emerald-400" />;
  return <Calendar className="h-3.5 w-3.5 text-amber-400" />;
}

function activityKindLabel(kind: ActivityKind) {
  if (kind === 'email') return 'Email';
  if (kind === 'file') return 'Drive file';
  return 'Calendar event';
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const tsLabel = item.timestamp
    ? new Date(item.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
    : '—';
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2 text-xs">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.04] ring-1 ring-white/[0.06]">
        {activityIcon(item.kind)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-foreground">{item.title}</div>
        <div className="truncate text-muted-foreground">{item.subtitle}</div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {activityKindLabel(item.kind)}
        </span>
        <span className="text-[10px] text-muted-foreground">{tsLabel}</span>
      </div>
      {item.link ? (
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Open in Google"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </div>
  );
}

// ─── Sync Dashboard ──────────────────────────────────────────────────────────
//
// Premium "sync status" panel that surfaces the high-level sync health at a
// glance. Only renders when Google is connected (the NotConnectedGate handles
// the not-connected path).
//
// Layout:
//   • Row 1: SyncStatusPill + Last sync + Next sync + Sync now button
//   • Row 2: 4 quick-action buttons (Sync now / View emails / Upload to Drive / Create event)
//   • Row 3: Recent activity feed (last 5 items across Gmail + Drive + Calendar)
//
// "Last sync" is derived from `status.connectedAt` (the OAuth grant timestamp)
// — there is no scheduled background sync, so the most recent relevant
// timestamp is when the user authorized the integration. If the user clicks
// "Sync now" we re-fetch all three sources and refresh the activity feed.
//
// "Next sync" is always "Manual" — there is no scheduled sync.

function SyncDashboard({ onJumpTab }: { onJumpTab: (tab: ServiceTab) => void }) {
  const {
    status,
    pending,
    refreshStatus,
    gmailMessages,
    driveFiles,
    calendarEvents,
  } = useGoogleWorkspace();

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  const loadActivity = useCallback(async () => {
    setLoadingActivity(true);
    setActivityError(null);
    try {
      const [mailRes, driveRes, calRes] = await Promise.all([
        gmailMessages(5),
        driveFiles(),
        calendarEvents(5),
      ]);
      const mailItems: ActivityItem[] = mailRes.ok && mailRes.data
        ? ((mailRes.data as { messages: Array<Record<string, unknown>> }).messages ?? [])
            .map(deriveEmailActivity)
            .filter((x): x is ActivityItem => x !== null)
        : [];
      const fileItems: ActivityItem[] = driveRes.ok && driveRes.data
        ? ((driveRes.data as { files: Array<Record<string, unknown>> }).files ?? [])
            .map(deriveFileActivity)
            .filter((x): x is ActivityItem => x !== null)
        : [];
      const eventItems: ActivityItem[] = calRes.ok && calRes.data
        ? ((calRes.data as { events: Array<Record<string, unknown>> }).events ?? [])
            .map(deriveEventActivity)
            .filter((x): x is ActivityItem => x !== null)
        : [];
      const all = [...mailItems, ...fileItems, ...eventItems];
      all.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
      setActivities(all.slice(0, 5));
      if (mailRes.error && driveRes.error && calRes.error) {
        setActivityError('Unable to load recent activity right now.');
      }
    } catch {
      setActivityError('Unable to load recent activity right now.');
    } finally {
      setLoadingActivity(false);
    }
  }, [gmailMessages, driveFiles, calendarEvents]);

  // Auto-load activity once on mount (when connected).
  useEffect(() => {
    if (status?.connected) {
      void loadActivity();
    }
  }, [status?.connected, loadActivity]);

  const handleSyncNow = useCallback(async () => {
    await Promise.all([refreshStatus(), loadActivity()]);
  }, [refreshStatus, loadActivity]);

  const lastSync = status?.connectedAt ?? null;

  return (
    <Card className="border-border/60 bg-card/50 backdrop-blur">
      <CardContent className="flex flex-col gap-5 p-6">
        {/* Row 1 — status + last/next sync + sync-now */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">Sync status</span>
            <SyncStatusPill connected={!!status?.connected} syncing={pending} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last sync: <span className="font-medium text-foreground">{timeAgo(lastSync)}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              Next sync: <span className="font-medium text-foreground">Manual</span>
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => void handleSyncNow()}
            disabled={pending || loadingActivity}
            className="h-8 gap-1.5 bg-[#4285F4] text-white hover:bg-[#3367d6]"
          >
            {pending || loadingActivity ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Sync now
          </Button>
        </div>

        {/* Row 2 — quick actions */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleSyncNow()}
            disabled={pending || loadingActivity}
            className="h-9 justify-start gap-2 text-xs"
          >
            <Zap className="h-3.5 w-3.5 text-[#4285F4]" />
            Sync now
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onJumpTab('gmail')}
            className="h-9 justify-start gap-2 text-xs"
          >
            <Mail className="h-3.5 w-3.5 text-[#EA4335]" />
            View emails
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onJumpTab('drive')}
            className="h-9 justify-start gap-2 text-xs"
          >
            <Upload className="h-3.5 w-3.5 text-emerald-400" />
            Upload to Drive
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onJumpTab('calendar')}
            className="h-9 justify-start gap-2 text-xs"
          >
            <CalendarPlus className="h-3.5 w-3.5 text-amber-400" />
            Create event
          </Button>
        </div>

        {/* Row 3 — recent activity */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Recent activity
              </span>
            </div>
            <button
              type="button"
              onClick={() => void loadActivity()}
              className="text-[10px] font-medium text-muted-foreground hover:text-foreground"
            >
              Refresh
            </button>
          </div>

          {loadingActivity && activities.length === 0 ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : activityError && activities.length === 0 ? (
            <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
              {activityError}{' '}
              <button
                type="button"
                onClick={() => void loadActivity()}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : activities.length === 0 ? (
            <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
              No recent activity yet — click{' '}
              <span className="font-medium text-foreground">Sync now</span>{' '}
              to populate the feed.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {activities.map((a) => (
                <ActivityRow key={a.id} item={a} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Result banner ───────────────────────────────────────────────────────────

function ResultBanner({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={result.ok ? 'ok' : 'err'}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
          result.ok
            ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
            : 'border-red-500/20 bg-red-500/5 text-red-400'
        }`}
      >
        {result.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
        <span className="leading-relaxed">{result.message}</span>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Gmail Tab ───────────────────────────────────────────────────────────────

function GmailTab() {
  const { gmailProfile, gmailMessages, gmailSend, gmailDraft, pending, status } = useGoogleWorkspace();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [messages, setMessages] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  // Tracks whether the initial auto-load has been kicked off, so the empty
  // state can distinguish "still fetching" from "truly empty inbox". The ref
  // mirrors it as a non-reactive guard so the effect below fires at most once.
  const [hasLoaded, setHasLoaded] = useState(false);
  const hasLoadedRef = useRef(false);

  // Compose form
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isHtml, setIsHtml] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const res = await gmailProfile();
    setProfile(res.ok && res.data ? (res.data as { profile: Record<string, unknown> }).profile : null);
    setLoading(false);
  }, [gmailProfile]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    const res = await gmailMessages(15);
    setMessages(res.ok && res.data ? ((res.data as { messages: Array<Record<string, unknown>> }).messages ?? []) : []);
    setLoading(false);
  }, [gmailMessages]);

  // Auto-load messages + profile the first time the Gmail tab is opened while
  // Google is connected — no need to click "Refresh". The ref guard guarantees
  // this runs at most once per mount (no refetch on every render or status
  // re-resolution). The manual Refresh button above still works for explicit
  // re-fetches.
  useEffect(() => {
    if (!status?.connected) return;
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasLoaded(true);
    void loadMessages();
    void loadProfile();
  }, [status?.connected, loadMessages, loadProfile]);

  const handleSend = useCallback(async () => {
    if (!to || !subject) {
      setResult({ ok: false, message: 'To and Subject are required.' });
      return;
    }
    const res = await gmailSend({ to, subject, body, isHtml });
    setResult(res.ok
      ? { ok: true, message: `Email sent to ${to}.`, data: res.data }
      : { ok: false, message: res.error ?? 'Failed to send email.' });
  }, [to, subject, body, isHtml, gmailSend]);

  const handleDraft = useCallback(async () => {
    if (!to || !subject) {
      setResult({ ok: false, message: 'To and Subject are required.' });
      return;
    }
    const res = await gmailDraft({ to, subject, body, isHtml });
    setResult(res.ok
      ? { ok: true, message: 'Draft created in Gmail.', data: res.data }
      : { ok: false, message: res.error ?? 'Failed to create draft.' });
  }, [to, subject, body, isHtml, gmailDraft]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border/60 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Send className="h-4 w-4" /> Compose & Send</CardTitle>
          <CardDescription className="text-xs">Send or draft an email via Gmail.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@example.com" className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Body</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Email content…" className="min-h-[120px] text-xs" />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={isHtml} onChange={(e) => setIsHtml(e.target.checked)} className="h-3.5 w-3.5 rounded" />
            Send as HTML
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSend} disabled={pending} className="h-8 gap-1.5 text-xs">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send
            </Button>
            <Button size="sm" variant="outline" onClick={handleDraft} disabled={pending} className="h-8 gap-1.5 text-xs">
              <FilePlus className="h-3.5 w-3.5" />
              Save Draft
            </Button>
          </div>
          <ResultBanner result={result} />
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4" /> Profile & History</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => { void loadProfile(); void loadMessages(); }} disabled={loading} className="h-7 gap-1.5 text-xs">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
          </div>
          <CardDescription className="text-xs">Your Gmail profile + recent messages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {profile ? (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{String(profile.emailAddress ?? '—')}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Total messages</span><span className="font-medium">{Number(profile.messagesTotal ?? 0).toLocaleString()}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Total threads</span><span className="font-medium">{Number(profile.threadsTotal ?? 0).toLocaleString()}</span></div>
            </div>
          ) : loading || !hasLoaded ? (
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center justify-between"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-32" /></div>
              <div className="flex items-center justify-between"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-20" /></div>
              <div className="flex items-center justify-between"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-20" /></div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No Gmail profile available.</p>
          )}
          <Separator />
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {messages.length === 0 ? (
              loading || !hasLoaded ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 px-1 pb-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Fetching your latest messages…</span>
                  </div>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="rounded-lg border border-border/40 bg-muted/20 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <Skeleton className="h-3 w-40" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                      <Skeleton className="mt-2 h-3 w-24" />
                      <Skeleton className="mt-1.5 h-2.5 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/50 bg-muted/10 px-3 py-6 text-center">
                  <Inbox className="h-5 w-5 text-muted-foreground/60" />
                  <p className="text-xs text-muted-foreground">
                    No messages in your inbox.
                  </p>
                </div>
              )
            ) : (
              messages.slice(0, 10).map((m) => {
                const headers = (m.payload as { headers?: Array<{ name: string; value: string }> } | undefined)?.headers ?? [];
                const from = headers.find((h) => h.name === 'From')?.value ?? 'Unknown';
                const subj = headers.find((h) => h.name === 'Subject')?.value ?? '(no subject)';
                return (
                  <div key={String(m.id)} className="rounded-lg border border-border/40 bg-muted/20 p-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{subj}</span>
                      <span className="shrink-0 text-muted-foreground">{m.internalDate ? new Date(Number(m.internalDate)).toLocaleDateString() : ''}</span>
                    </div>
                    <div className="truncate text-muted-foreground">{from}</div>
                    {m.snippet ? <div className="mt-1 line-clamp-1 text-muted-foreground">{String(m.snippet)}</div> : null}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Drive Tab ───────────────────────────────────────────────────────────────

function DriveTab() {
  const { driveFiles, driveFolder, driveUpload, pending } = useGoogleWorkspace();
  const [files, setFiles] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [folderName, setFolderName] = useState('');
  const [fileName, setFileName] = useState('');

  const loadFiles = useCallback(async () => {
    setLoading(true);
    const res = await driveFiles();
    setFiles(res.ok && res.data ? (res.data as { files: Array<Record<string, unknown>> }).files : []);
    setLoading(false);
  }, [driveFiles]);

  const handleFolder = useCallback(async () => {
    if (!folderName) { setResult({ ok: false, message: 'Folder name required.' }); return; }
    const res = await driveFolder(folderName);
    setResult(res.ok
      ? { ok: true, message: `Folder "${folderName}" created.`, data: res.data }
      : { ok: false, message: res.error ?? 'Failed to create folder.' });
    if (res.ok) { setFolderName(''); void loadFiles(); }
  }, [folderName, driveFolder, loadFiles]);

  const handleUpload = useCallback(async () => {
    if (!fileName) { setResult({ ok: false, message: 'File name required.' }); return; }
    // Upload a simple text file as a demo (production: real file picker).
    const content = 'GSTPilot export — ' + new Date().toISOString();
    const contentBase64 = btoa(content);
    const res = await driveUpload({ name: fileName, mimeType: 'text/plain', contentBase64 });
    setResult(res.ok
      ? { ok: true, message: `File "${fileName}" uploaded to Drive.`, data: res.data }
      : { ok: false, message: res.error ?? 'Failed to upload file.' });
    if (res.ok) { setFileName(''); void loadFiles(); }
  }, [fileName, driveUpload, loadFiles]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border/60 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Upload className="h-4 w-4" /> Create & Upload</CardTitle>
          <CardDescription className="text-xs">Create folders or upload files.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">New folder name</Label>
            <div className="flex gap-2">
              <Input value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="GSTPilot Invoices" className="h-8 text-xs" />
              <Button size="sm" onClick={handleFolder} disabled={pending} className="h-8 gap-1.5 text-xs">
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
                Create
              </Button>
            </div>
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Label className="text-xs">Upload text file (name)</Label>
            <div className="flex gap-2">
              <Input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="export.txt" className="h-8 text-xs" />
              <Button size="sm" onClick={handleUpload} disabled={pending} className="h-8 gap-1.5 text-xs">
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Upload
              </Button>
            </div>
          </div>
          <ResultBanner result={result} />
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm"><HardDrive className="h-4 w-4" /> Files</CardTitle>
            <Button size="sm" variant="ghost" onClick={loadFiles} disabled={loading} className="h-7 gap-1.5 text-xs">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
          </div>
          <CardDescription className="text-xs">Recent files in your Drive.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {files.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/50 bg-muted/10 px-3 py-6 text-center">
                <HardDrive className="h-5 w-5 text-muted-foreground/60" />
                <p className="text-xs text-muted-foreground">
                  No files loaded yet.
                </p>
                <p className="text-[10px] text-muted-foreground/70">
                  Click <span className="font-medium text-foreground">Refresh</span> above to list your recent Drive files.
                </p>
              </div>
            ) : (
              files.slice(0, 20).map((f) => (
                <div key={String(f.id)} className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-muted/20 p-2.5 text-xs">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{String(f.name ?? 'Untitled')}</div>
                    <div className="truncate text-muted-foreground">{String(f.mimeType ?? '')}</div>
                  </div>
                  {f.webViewLink ? (
                    <a href={String(f.webViewLink)} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Docs Tab ────────────────────────────────────────────────────────────────

function DocsTab() {
  const { docsCreate, pending } = useGoogleWorkspace();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [result, setResult] = useState<ActionResult | null>(null);
  const [docLink, setDocLink] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    if (!title) { setResult({ ok: false, message: 'Title required.' }); return; }
    const paragraphs = content.split('\n').filter(Boolean).map((text, i) => ({
      text,
      heading: i === 0 ? 'HEADING_1' as const : undefined,
    }));
    const res = await docsCreate({ title, paragraphs });
    if (res.ok && res.data) {
      const docId = (res.data as { document?: { documentId?: string } }).document?.documentId;
      const link = docId ? `https://docs.google.com/document/d/${docId}/edit` : null;
      setDocLink(link);
      setResult({ ok: true, message: `Document "${title}" created in Google Docs.`, data: res.data });
    } else {
      setResult({ ok: false, message: res.error ?? 'Failed to create document.' });
    }
  }, [title, content, docsCreate]);

  return (
    <Card className="border-border/60 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4" /> Generate Document</CardTitle>
        <CardDescription className="text-xs">Create a Google Doc with title + body content.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Document title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Invoice — Sharma Enterprises" className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Content (one paragraph per line)</Label>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={'Line 1 — heading\nLine 2 — body paragraph\nLine 3 — body paragraph'} className="min-h-[140px] text-xs" />
        </div>
        <Button size="sm" onClick={handleCreate} disabled={pending} className="h-8 gap-1.5 text-xs">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus className="h-3.5 w-3.5" />}
          Create Google Doc
        </Button>
        <ResultBanner result={result} />
        {docLink ? (
          <a href={docLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-[#4285F4] hover:underline">
            <ExternalLink className="h-3.5 w-3.5" /> Open document in Google Docs
          </a>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─── Sheets Tab ──────────────────────────────────────────────────────────────

function SheetsTab() {
  const { sheetsExport, pending } = useGoogleWorkspace();
  const [title, setTitle] = useState('');
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<ActionResult | null>(null);
  const [sheetLink, setSheetLink] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    if (!title || !csv) { setResult({ ok: false, message: 'Title + CSV data required.' }); return; }
    const rows = csv.trim().split('\n').map((line) => ({ values: line.split(',').map((c) => c.trim()) }));
    const res = await sheetsExport({ title, rows });
    if (res.ok && res.data) {
      const link = (res.data as { spreadsheet?: { webViewLink?: string } }).spreadsheet?.webViewLink ?? null;
      setSheetLink(link);
      setResult({ ok: true, message: `Spreadsheet "${title}" created with ${rows.length} rows.`, data: res.data });
    } else {
      setResult({ ok: false, message: res.error ?? 'Failed to export to Sheets.' });
    }
  }, [title, csv, sheetsExport]);

  return (
    <Card className="border-border/60 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm"><Table className="h-4 w-4" /> Export to Spreadsheet</CardTitle>
        <CardDescription className="text-xs">Create a Google Sheet from CSV data (first row = header).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Spreadsheet title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="GST Report — May 2025" className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">CSV data (comma-separated)</Label>
          <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'Month,Revenue,Tax,Net\nMay,250000,45000,205000\nJun,280000,50400,229600'} className="min-h-[140px] font-mono text-xs" />
        </div>
        <Button size="sm" onClick={handleExport} disabled={pending} className="h-8 gap-1.5 text-xs">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Export to Google Sheets
        </Button>
        <ResultBanner result={result} />
        {sheetLink ? (
          <a href={sheetLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-emerald-500 hover:underline">
            <ExternalLink className="h-3.5 w-3.5" /> Open spreadsheet in Google Sheets
          </a>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─── Calendar Tab ────────────────────────────────────────────────────────────

function CalendarTab() {
  const { calendarEvents, calendarCreate, pending } = useGoogleWorkspace();
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [summary, setSummary] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [attendees, setAttendees] = useState('');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const res = await calendarEvents(10);
    setEvents(res.ok && res.data ? (res.data as { events: Array<Record<string, unknown>> }).events : []);
    setLoading(false);
  }, [calendarEvents]);

  const handleCreate = useCallback(async () => {
    if (!summary || !start || !end) { setResult({ ok: false, message: 'Summary, start, and end are required.' }); return; }
    const attendeeList = attendees.split(',').map((e) => e.trim()).filter(Boolean);
    const res = await calendarCreate({
      summary,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      attendees: attendeeList.length ? attendeeList : undefined,
      reminders: [{ minutes: 30, method: 'email' }],
    });
    setResult(res.ok
      ? { ok: true, message: `Event "${summary}" scheduled.`, data: res.data }
      : { ok: false, message: res.error ?? 'Failed to create event.' });
    if (res.ok) { setSummary(''); setStart(''); setEnd(''); setAttendees(''); void loadEvents(); }
  }, [summary, start, end, attendees, calendarCreate, loadEvents]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border/60 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><CalendarPlus className="h-4 w-4" /> Schedule Event</CardTitle>
          <CardDescription className="text-xs">Create a calendar event with reminders.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Event summary</Label>
            <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="GSTR-1 Filing Reminder" className="h-8 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Start</Label>
              <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End</Label>
              <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Attendees (comma-separated emails)</Label>
            <Input value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="rajesh@firm.com, client@business.com" className="h-8 text-xs" />
          </div>
          <Button size="sm" onClick={handleCreate} disabled={pending} className="h-8 gap-1.5 text-xs">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
            Create Event
          </Button>
          <ResultBanner result={result} />
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4" /> Upcoming Events</CardTitle>
            <Button size="sm" variant="ghost" onClick={loadEvents} disabled={loading} className="h-7 gap-1.5 text-xs">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
          </div>
          <CardDescription className="text-xs">Your next 10 calendar events.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {events.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No events loaded. Click Refresh.</p>
            ) : (
              events.map((e) => {
                const startObj = e.start as { dateTime?: string; date?: string } | undefined;
                const startStr = startObj?.dateTime ?? startObj?.date ?? '';
                return (
                  <div key={String(e.id)} className="rounded-lg border border-border/40 bg-muted/20 p-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{String(e.summary ?? '(no title)')}</span>
                      {startStr ? <span className="shrink-0 text-muted-foreground">{new Date(startStr).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span> : null}
                    </div>
                    {e.htmlLink ? (
                      <a href={String(e.htmlLink)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-3 w-3" /> Open in Google Calendar
                      </a>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function GoogleWorkspacePage() {
  const { organization } = useOrg();
  const [tab, setTab] = useState<ServiceTab>('gmail');

  // Detect ?google_connected=1 or ?google_error=... from the OAuth callback
  // redirect and surface a one-shot toast-like banner.
  const [oauthBanner, setOauthBanner] = useState<{ ok: boolean; message: string } | null>(null);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('google_connected')) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOauthBanner({ ok: true, message: 'Google Workspace connected successfully.' });
      } else if (params.get('google_error')) {
        setOauthBanner({ ok: false, message: `Google connection failed: ${params.get('google_error')}` });
      }
      // Clean the URL.
      if (params.get('google_connected') || params.get('google_error')) {
        const clean = window.location.pathname;
        window.history.replaceState({}, '', clean);
      }
    } catch {
      /* SSR guard */
    }
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Google Workspace</h1>
          <Badge variant="outline" className="border-[#4285F4]/30 bg-[#4285F4]/10 text-[#4285F4]">
            Enterprise Integration
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {organization?.name ? `${organization.name} · ` : ''}Gmail, Drive, Docs, Sheets, and Calendar — connected with encrypted OAuth tokens.
        </p>
      </div>

      {/* OAuth banner */}
      <AnimatePresence>
        {oauthBanner ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
              oauthBanner.ok
                ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                : 'border-red-500/20 bg-red-500/5 text-red-400'
            }`}
          >
            {oauthBanner.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            <span className="flex-1">{oauthBanner.message}</span>
            <button onClick={() => setOauthBanner(null)} className="text-muted-foreground hover:text-foreground">
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Connection */}
      <ConnectionHeader />

      {/* Security note */}
      <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        <span>
          Tokens are AES-256-GCM encrypted at rest. Only your organization can access them. Disconnect anytime to revoke access.
        </span>
      </div>

      {/* Service tabs */}
      <NotConnectedGate>
        <Tabs value={tab} onValueChange={(v) => setTab(v as ServiceTab)} className="w-full">
          <TabsList className="grid w-full grid-cols-5 sm:w-auto sm:grid-cols-5">
            <TabsTrigger value="gmail" className="gap-1.5 text-xs"><Mail className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Gmail</span></TabsTrigger>
            <TabsTrigger value="drive" className="gap-1.5 text-xs"><HardDrive className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Drive</span></TabsTrigger>
            <TabsTrigger value="docs" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Docs</span></TabsTrigger>
            <TabsTrigger value="sheets" className="gap-1.5 text-xs"><Table className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sheets</span></TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5 text-xs"><Calendar className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Calendar</span></TabsTrigger>
          </TabsList>
          <TabsContent value="gmail" className="mt-4"><GmailTab /></TabsContent>
          <TabsContent value="drive" className="mt-4"><DriveTab /></TabsContent>
          <TabsContent value="docs" className="mt-4"><DocsTab /></TabsContent>
          <TabsContent value="sheets" className="mt-4"><SheetsTab /></TabsContent>
          <TabsContent value="calendar" className="mt-4"><CalendarTab /></TabsContent>
        </Tabs>
      </NotConnectedGate>
    </div>
  );
}
