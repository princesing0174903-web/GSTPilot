'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Google Workspace · Premium Integration Console
//
// A premium workspace experience built on top of the existing
// `useGoogleWorkspace` hook (no API changes). The page surfaces:
//
//   • Premium overview header — connected account, status badge, last sync,
//     organization, AES-256 security indicator, refresh + connect/disconnect.
//   • Pill-style tab navigation with sliding active indicator (framer-motion
//     layoutId) for Gmail · Drive · Docs · Sheets · Calendar.
//   • Per-tab premium content: metric strips, recent activity grids, quick
//     actions, AI email assistant, storage indicator, GST deadline grouping.
//   • Premium disconnected state with large illustration + Connect CTA.
//
// All data still flows through the original hook — Gmail messages, Drive
// files, Docs/Sheets creation, Calendar events — so OAuth, token refresh,
// and org-scoped requests behave exactly as before.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, HardDrive, FileText, Sheet, Calendar,
  CheckCircle2, XCircle, Loader2, RefreshCw, Plug, Unplug,
  Send, FolderPlus, Upload, FilePlus, Download, CalendarPlus,
  ExternalLink, AlertCircle, ShieldCheck, Clock,
  Zap, ArrowUpRight, Inbox, Paperclip, Activity,
  Sparkles, PenLine, Reply, Trash2, Share2, Star,
  Folder, File, Image as ImageIcon, Presentation, FileSpreadsheet,
  Building2, Lock, ChevronRight, CalendarClock, Receipt,
  Users, Wallet, FileSignature, TrendingUp, MoreHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useGoogleWorkspace, type GoogleConnectionState } from '@/hooks/useGoogleWorkspace';
import { useOrg } from '@/contexts/OrgContext';

type ServiceTab = 'gmail' | 'drive' | 'docs' | 'sheets' | 'calendar';

interface ActionResult {
  ok: boolean;
  message: string;
  data?: unknown;
}

// ─── Service meta ────────────────────────────────────────────────────────────

const SERVICE_META: Record<
  ServiceTab,
  { label: string; icon: LucideIcon; tint: string; description: string }
> = {
  gmail: { label: 'Gmail', icon: Mail, tint: '#EA4335', description: 'Inbox, drafts & AI assistant' },
  drive: { label: 'Drive', icon: HardDrive, tint: '#34A853', description: 'Files, storage & sharing' },
  docs: { label: 'Docs', icon: FileText, tint: '#4285F4', description: 'Documents & AI reports' },
  sheets: { label: 'Sheets', icon: Sheet, tint: '#0F9D58', description: 'Financial & GST sheets' },
  calendar: { label: 'Calendar', icon: Calendar, tint: '#FBBC05', description: 'Deadlines & meetings' },
};

const TAB_ORDER: ServiceTab[] = ['gmail', 'drive', 'docs', 'sheets', 'calendar'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Never';
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return d.toLocaleDateString();
}

function getInitials(email: string | null): string {
  if (!email) return 'G';
  const name = email.split('@')[0] ?? '';
  const parts = name.split(/[._-]/).filter(Boolean);
  if (parts.length === 0) return email.charAt(0).toUpperCase();
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function extractHeader(m: Record<string, unknown>, name: string): string {
  const headers = (m.payload as { headers?: Array<{ name: string; value: string }> } | undefined)?.headers ?? [];
  return headers.find((h) => h.name === name)?.value ?? '';
}

function isMessageUnread(m: Record<string, unknown>): boolean {
  return Array.isArray(m.labelIds) && (m.labelIds as string[]).includes('UNREAD');
}

function isStarred(m: Record<string, unknown>): boolean {
  return Array.isArray(m.labelIds) && (m.labelIds as string[]).includes('STARRED');
}

type FileKind = 'doc' | 'sheet' | 'slide' | 'pdf' | 'image' | 'folder' | 'file';

function classifyFile(mimeType: unknown): FileKind {
  const mt = String(mimeType ?? '');
  if (mt === 'application/vnd.google-apps.document') return 'doc';
  if (mt === 'application/vnd.google-apps.spreadsheet') return 'sheet';
  if (mt === 'application/vnd.google-apps.presentation') return 'slide';
  if (mt === 'application/vnd.google-apps.folder') return 'folder';
  if (mt === 'application/pdf' || mt.includes('pdf')) return 'pdf';
  if (mt.startsWith('image/')) return 'image';
  return 'file';
}

function fileIcon(kind: FileKind): { icon: LucideIcon; tint: string } {
  switch (kind) {
    case 'doc': return { icon: FileText, tint: '#4285F4' };
    case 'sheet': return { icon: FileSpreadsheet, tint: '#0F9D58' };
    case 'slide': return { icon: Presentation, tint: '#FBBC05' };
    case 'pdf': return { icon: FileText, tint: '#EF4444' };
    case 'image': return { icon: ImageIcon, tint: '#A855F7' };
    case 'folder': return { icon: Folder, tint: '#FBBF24' };
    default: return { icon: File, tint: '#A1A1AA' };
  }
}

function formatDateShort(value: string | number | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'number' ? new Date(value) : new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

function eventStart(e: Record<string, unknown>): string {
  const s = e.start as { dateTime?: string; date?: string } | undefined;
  return s?.dateTime ?? s?.date ?? '';
}

// ─── Google "G" glyph ───────────────────────────────────────────────────────

function GoogleGlyph({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

// ─── Premium empty state ─────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  description,
  tint = '#A1A1AA',
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="gst-empty-state">
      <div className="gst-empty-state-icon" style={{ borderColor: `${tint}33`, background: `${tint}14` }}>
        <Icon className="h-7 w-7" style={{ color: tint }} />
      </div>
      <div className="gst-empty-state-title">{title}</div>
      <div className="gst-empty-state-desc">{description}</div>
      {action}
    </div>
  );
}

// ─── Connection state badge (4 states) ───────────────────────────────────────
//
// P3-GW-STALE-UI — surfaces the 4-state connection model from
// /api/integrations/google/status:
//
//   • live          — token valid, recently synced (within 24h)   → green
//   • stale         — token exists + refresh succeeds, but no data
//                      sync in > 24h                              → amber
//   • disconnected  — no token / never connected / revoked        → gray
//   • error         — token refresh failed permanently, OR env
//                      vars missing, OR token undecryptable      → red
//
// Uses the existing shadcn/ui Badge component with custom Tailwind color
// overrides (the built-in variants default/secondary/destructive/outline
// don't cover green or amber, so we layer className on top of variant="outline").

interface StateBadgeConfig {
  label: string;
  icon: LucideIcon;
  className: string;
}

const STATE_BADGE_CONFIG: Record<GoogleConnectionState, StateBadgeConfig> = {
  live: {
    label: 'Live',
    icon: CheckCircle2,
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  },
  stale: {
    label: 'Stale',
    icon: Clock,
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  },
  disconnected: {
    label: 'Disconnected',
    icon: XCircle,
    className: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
  },
  error: {
    label: 'Error',
    icon: AlertCircle,
    className: 'border-red-500/30 bg-red-500/10 text-red-400',
  },
};

function StatusBadge({
  state,
  errorMessage,
  loading = false,
}: {
  state: GoogleConnectionState | null;
  errorMessage?: string | null;
  loading?: boolean;
}) {
  if (loading || !state) {
    return (
      <Badge variant="outline" className="border-zinc-500/30 bg-zinc-500/10 text-zinc-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking
      </Badge>
    );
  }
  const cfg = STATE_BADGE_CONFIG[state];
  const Icon = cfg.icon;
  return (
    <Badge
      variant="outline"
      className={cfg.className}
      title={errorMessage ?? undefined}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

// ─── Stale banner (shown when state === 'stale') ─────────────────────────────

function StaleBanner({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-300"
    >
      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="flex-1 leading-relaxed">
        <span className="font-semibold text-amber-200">Stale data.</span>{' '}
        Your Google Workspace data hasn&apos;t synced in over 24 hours
        {lastSyncedAt ? ` (last sync ${timeAgo(lastSyncedAt)})` : ''}.
        Live Gmail, Drive, Docs, Sheets and Calendar data may be delayed. Try refreshing or take an action (e.g. fetch Gmail) to re-sync.
      </div>
    </motion.div>
  );
}

// ─── Error banner (shown when state === 'error') ─────────────────────────────

function ErrorBanner({ message }: { message: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2.5 text-xs text-red-300"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="flex-1 leading-relaxed">
        <span className="font-semibold text-red-200">Connection error.</span>{' '}
        {message ?? 'Google Workspace token refresh failed. Please reconnect your account.'}
      </div>
    </motion.div>
  );
}

// ─── Skeletons ───────────────────────────────────────────────────────────────

function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="gst-card">
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
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

// ─── Connection / Overview Header ────────────────────────────────────────────
//
// Premium header card showing:
//   • Connected Google account (avatar with initials + Google "G" badge)
//   • Connection status badge (success / warning / syncing)
//   • Last sync time
//   • Organization
//   • Security indicator (AES-256-GCM)
//   • Refresh button
//   • Connect / Disconnect actions
//
// All actions still call the existing `useGoogleWorkspace` hook methods.

function ConnectionHeader() {
  const { status, statusLoading, connect, disconnect, pending, refreshStatus } = useGoogleWorkspace();
  const { organization } = useOrg();
  const [connectError, setConnectError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConnect = useCallback(async () => {
    setConnectError(null);
    const { authUrl, error } = await connect();
    if (error) {
      setConnectError(error);
      return;
    }
    if (authUrl) window.location.href = authUrl;
  }, [connect]);

  const confirmDisconnect = useCallback(async () => {
    setConfirmOpen(false);
    const { error } = await disconnect();
    if (error) setConnectError(error);
  }, [disconnect]);

  const connected = !!status?.connected;
  const state = status?.state ?? null;
  const email = status?.userEmail ?? null;
  const initials = getInitials(email);

  return (
    <>
      <div className="gst-card gst-animate-in relative overflow-hidden p-6 md:p-7">
        {/* Decorative gradient accents */}
        <div className="pointer-events-none absolute -top-32 -right-24 h-72 w-72 rounded-full bg-[#2563EB]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-[#4285F4]/5 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {/* Account identity */}
          <div className="flex items-start gap-4">
            {/* Avatar with Google glyph badge */}
            <div className="relative shrink-0">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-lg font-bold text-white shadow-lg shadow-[#2563EB]/20 ring-1 ring-white/10">
                {initials}
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#0A0A0A] ring-2 ring-[#0A0A0A]">
                <GoogleGlyph className="h-4 w-4" />
              </div>
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="gst-card-title text-base">
                  {connected ? (email ?? 'Connected account') : 'Google Workspace'}
                </h2>
                {/* P3-GW-STALE-UI — 4-state status badge (live/stale/disconnected/error) */}
                <StatusBadge
                  state={state}
                  errorMessage={status?.errorMessage}
                  loading={statusLoading}
                />
              </div>
              <p className="gst-description max-w-md">
                {connected
                  ? 'Manage Gmail, Drive, Docs, Sheets and Calendar from one premium workspace.'
                  : 'Connect your Google account to enable Gmail, Drive, Docs, Sheets and Calendar.'}
              </p>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-muted-foreground">
                {organization?.name ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground/80">{organization.name}</span>
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Last sync <span className="font-medium text-foreground/80">{timeAgo(status?.lastSyncedAt ?? status?.connectedAt ?? null)}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="font-medium text-emerald-500/90">AES-256-GCM encrypted</span>
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshStatus()}
              disabled={statusLoading || pending}
              className="gst-btn gst-btn-ghost gst-btn-sm"
            >
              {statusLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </button>
            {connected ? (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={pending}
                className="gst-btn gst-btn-outline gst-btn-sm"
                style={{ borderColor: '#EF444433', color: '#F87171' }}
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={pending}
                className="gst-btn gst-btn-primary gst-btn-sm"
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
                {state === 'error' ? 'Reconnect Google' : 'Connect Google'}
              </button>
            )}
          </div>
        </div>

        {/* Connect error */}
        {connectError ? (
          <div className="relative mt-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {connectError}
          </div>
        ) : null}

        {/* P3-GW-STALE-UI — Stale banner (only when state === 'stale') */}
        {connected && state === 'stale' ? (
          <div className="relative mt-4">
            <StaleBanner lastSyncedAt={status?.lastSyncedAt ?? null} />
          </div>
        ) : null}

        {/* Scope chips */}
        {connected && status?.scopes.length > 0 ? (
          <div className="relative mt-5 flex flex-wrap items-center gap-1.5 border-t border-[#1F1F1F] pt-4">
            <span className="gst-caption mr-1">Authorized services</span>
            {TAB_ORDER.map((s) => {
              const meta = SERVICE_META[s];
              const Icon = meta.icon;
              return (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-md border border-[#1F1F1F] bg-[#0F0F0F] px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  <Icon className="h-3 w-3" style={{ color: meta.tint }} />
                  {meta.label}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google Workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              Live data from Gmail, Drive, Docs, Sheets and Calendar will stop syncing. Encrypted tokens will be revoked. You can reconnect anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDisconnect}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Not-connected gate (premium empty state) ────────────────────────────────

function NotConnectedGate({ children, onConnect }: { children: React.ReactNode; onConnect: () => void }) {
  const { status, statusLoading, pending } = useGoogleWorkspace();
  if (statusLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
      </div>
    );
  }
  if (!status?.connected) {
    const isError = status?.state === 'error';
    return (
      <div className="gst-card gst-animate-in relative overflow-hidden p-8 md:p-12">
        <div className="pointer-events-none absolute -top-32 right-0 h-72 w-72 rounded-full bg-[#2563EB]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-0 h-72 w-72 rounded-full bg-[#4285F4]/5 blur-3xl" />
        <div className="relative flex flex-col items-center gap-6 text-center">
          {/* Large illustration */}
          <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-[#2563EB]/20 to-[#4285F4]/5 ring-1 ring-[#2563EB]/30">
            <GoogleGlyph className="h-12 w-12" />
            <div className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#0A0A0A] ring-2 ring-[#0A0A0A]">
              {isError ? (
                <AlertCircle className="h-4 w-4 text-[#F87171]" />
              ) : (
                <Plug className="h-4 w-4 text-[#60A5FA]" />
              )}
            </div>
          </div>

          <div className="space-y-2 max-w-md">
            {/* P3-GW-STALE-UI — title + description differ for ERROR vs DISCONNECTED */}
            <h3 className="gst-section-title">
              {isError ? 'Reconnect Google Workspace' : 'Connect Google Workspace'}
            </h3>
            <p className="gst-description">
              {isError
                ? 'Your Google Workspace connection is no longer working. This usually means access was revoked, the OAuth client secret was rotated, or the server is missing credentials. Reconnect to restore Gmail, Drive, Docs, Sheets and Calendar.'
                : 'Unlock a premium integration with Gmail, Drive, Docs, Sheets and Calendar. Send invoices via Gmail, sync GSTR reports to Drive, export financials to Sheets, and never miss a GST deadline on Calendar.'}
            </p>
          </div>

          {/* P3-GW-STALE-UI — surface the error message (if any) above the CTA */}
          {isError && status?.errorMessage ? (
            <div className="w-full max-w-md">
              <ErrorBanner message={status.errorMessage} />
            </div>
          ) : null}

          {/* Service chips */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {TAB_ORDER.map((s) => {
              const meta = SERVICE_META[s];
              const Icon = meta.icon;
              return (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#1F1F1F] bg-[#0F0F0F] px-3 py-1.5 text-xs font-medium text-muted-foreground"
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: meta.tint }} />
                  {meta.label}
                </span>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row">
            <button
              type="button"
              onClick={onConnect}
              disabled={pending}
              className="gst-btn gst-btn-primary gst-btn-lg"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              {isError ? 'Reconnect Google Account' : 'Connect Google Account'}
            </button>
            <span className="gst-caption inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-emerald-500" />
              OAuth 2.0 · Tokens encrypted at rest
            </span>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

// ─── Overview stats row ──────────────────────────────────────────────────────
//
// 4 metric cards derived from a single on-mount Promise.all of Gmail +
// Drive + Calendar (re-using the existing hook). Only shown when connected.

interface OverviewMetrics {
  unread: number;
  totalEmails: number;
  files: number;
  docs: number;
  sheets: number;
  events: number;
  gstDeadlines: number;
  caMeetings: number;
}

const EMPTY_METRICS: OverviewMetrics = {
  unread: 0,
  totalEmails: 0,
  files: 0,
  docs: 0,
  sheets: 0,
  events: 0,
  gstDeadlines: 0,
  caMeetings: 0,
};

function useOverviewMetrics(enabled: boolean) {
  const { gmailMessages, driveFiles, calendarEvents } = useGoogleWorkspace();
  const [metrics, setMetrics] = useState<OverviewMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(false);
  const firedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mailRes, driveRes, calRes] = await Promise.all([
        gmailMessages(20),
        driveFiles(),
        calendarEvents(15),
      ]);
      const msgs = mailRes.ok && mailRes.data
        ? ((mailRes.data as { messages: Array<Record<string, unknown>> }).messages ?? [])
        : [];
      const files = driveRes.ok && driveRes.data
        ? ((driveRes.data as { files: Array<Record<string, unknown>> }).files ?? [])
        : [];
      const events = calRes.ok && calRes.data
        ? ((calRes.data as { events: Array<Record<string, unknown>> }).events ?? [])
        : [];
      setMetrics({
        unread: msgs.filter(isMessageUnread).length,
        totalEmails: msgs.length,
        files: files.length,
        docs: files.filter((f) => classifyFile(f.mimeType) === 'doc').length,
        sheets: files.filter((f) => classifyFile(f.mimeType) === 'sheet').length,
        events: events.length,
        gstDeadlines: events.filter((e) => /gst|gstr/i.test(String(e.summary ?? ''))).length,
        caMeetings: events.filter((e) => /\bca\b|chartered accountant|auditor/i.test(String(e.summary ?? ''))).length,
      });
    } catch {
      /* keep empty metrics */
    } finally {
      setLoading(false);
    }
  }, [gmailMessages, driveFiles, calendarEvents]);

  useEffect(() => {
    if (!enabled) return;
    if (firedRef.current) return;
    firedRef.current = true;
    void load();
  }, [enabled, load]);

  return { metrics, loading, reload: load };
}

function OverviewStatsRow() {
  const { status } = useGoogleWorkspace();
  const { metrics, loading, reload } = useOverviewMetrics(!!status?.connected);

  const cards: Array<{
    label: string;
    value: string;
    icon: LucideIcon;
    tint: string;
    sub?: string;
  }> = [
    { label: 'Unread Emails', value: String(metrics.unread), icon: Mail, tint: '#EA4335', sub: `${metrics.totalEmails} total synced` },
    { label: 'Drive Files', value: String(metrics.files), icon: HardDrive, tint: '#34A853', sub: `${metrics.docs} docs · ${metrics.sheets} sheets` },
    { label: 'GST Deadlines', value: String(metrics.gstDeadlines), icon: CalendarClock, tint: '#FBBC05', sub: `${metrics.events} upcoming events` },
    { label: 'CA Meetings', value: String(metrics.caMeetings), icon: Users, tint: '#4285F4', sub: 'Synced from Calendar' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="gst-card gst-card-hover gst-animate-in p-5"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="gst-caption">{c.label}</span>
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: `${c.tint}14`, border: `1px solid ${c.tint}33` }}
              >
                <Icon className="h-4 w-4" style={{ color: c.tint }} />
              </div>
            </div>
            <div className="mt-3 flex items-end gap-2">
              {loading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <span className="gst-metric">{c.value}</span>
              )}
            </div>
            {c.sub ? <div className="gst-caption mt-1">{c.sub}</div> : null}
          </div>
        );
      })}
      {/* Hidden reload trigger kept for future use */}
      <span className="sr-only">
        <button onClick={() => void reload()} type="button" aria-label="Reload metrics" />
      </span>
    </div>
  );
}

// ─── Premium pill tabs ───────────────────────────────────────────────────────

function PremiumTabs({
  tab,
  setTab,
  badges,
}: {
  tab: ServiceTab;
  setTab: (t: ServiceTab) => void;
  badges: Partial<Record<ServiceTab, number>>;
}) {
  return (
    <div
      role="tablist"
      aria-label="Google Workspace services"
      className="flex w-full flex-wrap gap-1.5 rounded-xl border border-[#1F1F1F] bg-[#0A0A0A] p-1.5"
    >
      {TAB_ORDER.map((t) => {
        const meta = SERVICE_META[t];
        const Icon = meta.icon;
        const active = tab === t;
        const badge = badges[t];
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setTab(t)}
            className={`relative inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors sm:flex-none sm:px-4 ${
              active ? 'text-white' : 'text-muted-foreground hover:bg-[#111111] hover:text-foreground'
            }`}
          >
            {active ? (
              <motion.span
                layoutId="premium-tab-active"
                className="absolute inset-0 rounded-lg bg-[#2563EB] shadow-lg shadow-[#2563EB]/25"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            ) : null}
            <span className="relative flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{meta.label}</span>
              {typeof badge === 'number' && badge > 0 ? (
                <span
                  className={`relative inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[11px] font-bold ${
                    active ? 'bg-white/20 text-white' : 'bg-[#2563EB]/15 text-[#60A5FA]'
                  }`}
                >
                  {badge}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Section header (used inside each tab) ───────────────────────────────────

function SectionHeader({
  icon: Icon,
  tint,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  tint: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: `${tint}14`, border: `1px solid ${tint}33` }}
        >
          <Icon className="h-4.5 w-4.5" style={{ color: tint }} />
        </div>
        <div>
          <h2 className="gst-section-title">{title}</h2>
          {description ? <p className="gst-caption mt-0.5">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

// ─── Gmail Tab ───────────────────────────────────────────────────────────────
//
// Sections:
//   • Recent Emails list (with unread badge, snippet, star, open-in-Gmail)
//   • Compose card (send / save draft)
//   • AI Email Assistant card (template-based: invoice reminder, GST notice,
//     payment follow-up) — fills the compose form using existing gmailSend.

const AI_TEMPLATES: Array<{
  id: 'invoice' | 'gst' | 'payment' | 'onboarding';
  label: string;
  icon: LucideIcon;
  tint: string;
  subject: string;
  body: string;
}> = [
  {
    id: 'invoice',
    label: 'Invoice Reminder',
    icon: Receipt,
    tint: '#F59E0B',
    subject: 'Invoice Reminder — Payment Due',
    body: 'Dear Client,\n\nThis is a gentle reminder that invoice #INV-2025-001 for ₹X is now due. Kindly process the payment at your earliest convenience. The detailed invoice is attached for your reference.\n\nWarm regards,\nGSTPilot',
  },
  {
    id: 'gst',
    label: 'GST Filing Notice',
    icon: FileSignature,
    tint: '#2563EB',
    subject: 'GSTR-1 Filing — Action Required',
    body: 'Dear Client,\n\nYour GSTR-1 return for the current tax period is scheduled for filing. Please review the enclosed summary and approve at the earliest to avoid late fees under Section 47 of the CGST Act.\n\nRegards,\nGSTPilot Compliance Desk',
  },
  {
    id: 'payment',
    label: 'Payment Follow-up',
    icon: Wallet,
    tint: '#EF4444',
    subject: 'Payment Follow-up — Overdue',
    body: 'Dear Client,\n\nWe note that the payment for invoice #INV-2025-001 remains outstanding beyond the agreed credit period. Request your immediate attention to clear the dues. Please reach out if you need a copy of the invoice or a reconciliation statement.\n\nBest regards,\nGSTPilot',
  },
  {
    id: 'onboarding',
    label: 'Client Onboarding',
    icon: Sparkles,
    tint: '#8B5CF6',
    subject: 'Welcome to GSTPilot — Onboarding Checklist',
    body: 'Dear Client,\n\nWelcome aboard! To begin your GST compliance journey with us, please share the following documents:\n  • GSTIN certificate\n  • PAN card\n  • Bank account details\n  • Recent GSTR-1 / GSTR-3B filings\n\nOur team will reach out within 24 hours to complete the onboarding.\n\nWarm regards,\nGSTPilot',
  },
];

function GmailTab() {
  const { gmailProfile, gmailMessages, gmailSend, gmailDraft, pending, status } = useGoogleWorkspace();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [messages, setMessages] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const hasLoadedRef = useRef(false);

  // Compose form
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isHtml, setIsHtml] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    const res = await gmailProfile();
    setProfile(res.ok && res.data ? (res.data as { profile: Record<string, unknown> }).profile : null);
  }, [gmailProfile]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    const res = await gmailMessages(15);
    setMessages(res.ok && res.data ? ((res.data as { messages: Array<Record<string, unknown>> }).messages ?? []) : []);
    setLoading(false);
  }, [gmailMessages]);

  useEffect(() => {
    if (!status?.connected) return;
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasLoaded(true);
    void loadMessages();
    void loadProfile();
  }, [status?.connected, loadMessages, loadProfile]);

  const reloadAll = useCallback(() => {
    void loadProfile();
    void loadMessages();
  }, [loadProfile, loadMessages]);

  const handleSend = useCallback(async () => {
    if (!to || !subject) {
      setResult({ ok: false, message: 'To and Subject are required.' });
      return;
    }
    const res = await gmailSend({ to, subject, body, isHtml });
    setResult(res.ok
      ? { ok: true, message: `Email sent to ${to}.`, data: res.data }
      : { ok: false, message: res.error ?? 'Failed to send email.' });
    if (res.ok) { setTo(''); setSubject(''); setBody(''); setComposeOpen(false); void loadMessages(); }
  }, [to, subject, body, isHtml, gmailSend, loadMessages]);

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

  const applyTemplate = useCallback((t: typeof AI_TEMPLATES[number]) => {
    setSubject(t.subject);
    setBody(t.body);
    setComposeOpen(true);
    setResult({ ok: true, message: `Template "${t.label}" loaded into compose.` });
  }, []);

  const unreadCount = messages.filter(isMessageUnread).length;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Left column — Recent Emails + AI Assistant */}
      <div className="space-y-4 lg:col-span-2">
        {/* Section header */}
        <SectionHeader
          icon={Mail}
          tint={SERVICE_META.gmail.tint}
          title="Recent Emails"
          description={`${unreadCount} unread · ${messages.length} synced`}
          action={
            <div className="flex items-center gap-2">
              <button type="button" onClick={reloadAll} disabled={loading} className="gst-btn gst-btn-ghost gst-btn-sm">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </button>
              <button type="button" onClick={() => setComposeOpen((v) => !v)} className="gst-btn gst-btn-primary gst-btn-sm">
                <PenLine className="h-3.5 w-3.5" />
                Compose
              </button>
            </div>
          }
        />

        {/* Emails card */}
        <div className="gst-card gst-animate-in p-0" style={{ animationDelay: '40ms' }}>
          {loading && messages.length === 0 ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <EmptyState
              icon={Inbox}
              tint={SERVICE_META.gmail.tint}
              title="No messages synced yet"
              description="Click Refresh to fetch your latest Gmail messages. Connected accounts auto-load on first visit."
            />
          ) : (
            <ul className="divide-y divide-[#1F1F1F]">
              {messages.slice(0, 10).map((m) => {
                const from = extractHeader(m, 'From') || 'Unknown sender';
                const subj = extractHeader(m, 'Subject') || '(no subject)';
                const unread = isMessageUnread(m);
                const starred = isStarred(m);
                const ts = m.internalDate ? Number(m.internalDate) : null;
                const senderName = from.split('<')[0]?.trim() || from;
                const senderInitial = senderName.charAt(0).toUpperCase();
                return (
                  <li key={String(m.id)} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#0F0F0F]">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${unread ? 'bg-[#2563EB]/15 text-[#60A5FA]' : 'bg-[#181818] text-muted-foreground'}`}>
                      {senderInitial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`truncate text-sm ${unread ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>
                          {senderName}
                        </span>
                        {starred ? <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" /> : null}
                        {unread ? <span className="gst-status gst-status-info !px-1.5 !py-0 !text-[11px]">New</span> : null}
                      </div>
                      <div className={`truncate text-xs ${unread ? 'text-foreground/80' : 'text-muted-foreground'}`}>
                        {subj}
                      </div>
                      {m.snippet ? <div className="truncate text-[11px] text-muted-foreground/70">{String(m.snippet)}</div> : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="gst-caption whitespace-nowrap">{formatDateShort(ts)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* AI Email Assistant */}
        <div className="gst-card gst-animate-in relative overflow-hidden p-6" style={{ animationDelay: '100ms' }}>
          <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-[#8B5CF6]/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B5CF6]/15 ring-1 ring-[#8B5CF6]/30">
                <Sparkles className="h-5 w-5 text-[#A78BFA]" />
              </div>
              <div>
                <h3 className="gst-card-title">AI Email Assistant</h3>
                <p className="gst-caption mt-0.5">One-tap templates for GST communications</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {AI_TEMPLATES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="group flex flex-col items-start gap-2 rounded-lg border border-[#1F1F1F] bg-[#0F0F0F] p-3 text-left transition-all hover:border-[#2A2A2A] hover:bg-[#111111]"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: `${t.tint}14`, border: `1px solid ${t.tint}33` }}>
                      <Icon className="h-3.5 w-3.5" style={{ color: t.tint }} />
                    </div>
                    <span className="text-xs font-medium text-foreground">{t.label}</span>
                  </button>
                );
              })}
            </div>
            <ResultBanner result={result} />
          </div>
        </div>
      </div>

      {/* Right column — Compose card + Profile */}
      <div className="space-y-4">
        {/* Profile card */}
        <div className="gst-card gst-animate-in p-5" style={{ animationDelay: '60ms' }}>
          <div className="flex items-center gap-2.5">
            <Mail className="h-4 w-4 text-[#EA4335]" />
            <h3 className="gst-card-title">Gmail Profile</h3>
          </div>
          <div className="mt-4 space-y-2.5">
            {profile ? (
              <>
                <ProfileRow label="Email" value={String(profile.emailAddress ?? '—')} />
                <ProfileRow label="Total messages" value={Number(profile.messagesTotal ?? 0).toLocaleString()} />
                <ProfileRow label="Total threads" value={Number(profile.threadsTotal ?? 0).toLocaleString()} />
              </>
            ) : loading || !hasLoaded ? (
              <>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </>
            ) : (
              <p className="gst-caption">No Gmail profile available.</p>
            )}
          </div>
        </div>

        {/* Compose card */}
        <AnimatePresence>
          {composeOpen ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="gst-card gst-animate-in p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <PenLine className="h-4 w-4 text-[#60A5FA]" />
                  <h3 className="gst-card-title">Compose</h3>
                </div>
                <button type="button" onClick={() => setComposeOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="gst-label">To</Label>
                  <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@example.com" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="gst-label">Subject</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="gst-label">Body</Label>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Email content…" className="min-h-[140px] text-sm" />
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={isHtml} onChange={(e) => setIsHtml(e.target.checked)} className="h-3.5 w-3.5 rounded" />
                  Send as HTML
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" onClick={handleSend} disabled={pending} className="gst-btn gst-btn-primary gst-btn-sm">
                    {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Send
                  </button>
                  <button type="button" onClick={handleDraft} disabled={pending} className="gst-btn gst-btn-outline gst-btn-sm">
                    <FilePlus className="h-3.5 w-3.5" />
                    Save Draft
                  </button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium text-foreground">{value}</span>
    </div>
  );
}

// ─── Drive Tab ───────────────────────────────────────────────────────────────
//
// Sections:
//   • Storage & Activity card (file count + progress bar derived from synced
//     files, plus "Open Drive" CTA — links to drive.google.com)
//   • Quick Actions card (Create folder, Upload file)
//   • Recent Files grid (premium file cards with type icon, name, mime, link)
//   • Shared Files (filtered subset — files where sharedWithMeTime is present)

function DriveTab() {
  const { driveFiles, driveFolder, driveUpload, pending } = useGoogleWorkspace();
  const [files, setFiles] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [folderName, setFolderName] = useState('');
  const [fileName, setFileName] = useState('');
  const hasLoadedRef = useRef(false);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    const res = await driveFiles();
    setFiles(res.ok && res.data ? (res.data as { files: Array<Record<string, unknown>> }).files : []);
    setLoading(false);
  }, [driveFiles]);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFiles();
  }, [loadFiles]);

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
    const content = 'GSTPilot export — ' + new Date().toISOString();
    const contentBase64 = btoa(content);
    const res = await driveUpload({ name: fileName, mimeType: 'text/plain', contentBase64 });
    setResult(res.ok
      ? { ok: true, message: `File "${fileName}" uploaded to Drive.`, data: res.data }
      : { ok: false, message: res.error ?? 'Failed to upload file.' });
    if (res.ok) { setFileName(''); void loadFiles(); }
  }, [fileName, driveUpload, loadFiles]);

  const sharedFiles = files.filter((f) => Boolean(f.sharedWithMeTime));
  const recentFiles = files.slice(0, 12);
  // "Activity" indicator: relative fill based on synced count (capped).
  const activityPct = Math.min(100, Math.round((files.length / 30) * 100));

  return (
    <div className="space-y-4">
      {/* Top row — Storage + Quick Actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Storage & activity */}
        <div className="gst-card gst-animate-in relative overflow-hidden p-5 lg:col-span-2" style={{ animationDelay: '40ms' }}>
          <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-[#34A853]/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#34A853]/15 ring-1 ring-[#34A853]/30">
                  <HardDrive className="h-4.5 w-4.5 text-[#34A853]" />
                </div>
                <div>
                  <h3 className="gst-card-title">Drive Storage & Activity</h3>
                  <p className="gst-caption mt-0.5">{files.length} files synced · {sharedFiles.length} shared with you</p>
                </div>
              </div>
              <a
                href="https://drive.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="gst-btn gst-btn-outline gst-btn-sm"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Drive
              </a>
            </div>

            {/* Activity bar */}
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Recent activity</span>
                <span className="font-medium text-foreground">{activityPct}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#181818]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${activityPct}%` }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full bg-gradient-to-r from-[#34A853] to-[#0F9D58]"
                />
              </div>
              <p className="gst-caption mt-2">Bar reflects volume of recently synced files relative to the typical 30-day window.</p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="gst-card gst-animate-in p-5" style={{ animationDelay: '80ms' }}>
          <div className="flex items-center gap-2.5">
            <Zap className="h-4 w-4 text-[#FBBF24]" />
            <h3 className="gst-card-title">Quick Actions</h3>
          </div>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="gst-label">New folder</Label>
              <div className="flex gap-2">
                <Input value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="GSTPilot Invoices" className="h-9" />
                <button type="button" onClick={handleFolder} disabled={pending} className="gst-btn gst-btn-primary gst-btn-sm shrink-0">
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
                  Create
                </button>
              </div>
            </div>
            <Separator className="bg-[#1F1F1F]" />
            <div className="space-y-1.5">
              <Label className="gst-label">Upload text file</Label>
              <div className="flex gap-2">
                <Input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="export.txt" className="h-9" />
                <button type="button" onClick={handleUpload} disabled={pending} className="gst-btn gst-btn-outline gst-btn-sm shrink-0">
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Upload
                </button>
              </div>
            </div>
            <ResultBanner result={result} />
          </div>
        </div>
      </div>

      {/* Recent files grid */}
      <SectionHeader
        icon={FileText}
        tint={SERVICE_META.drive.tint}
        title="Recent Files"
        description={`${recentFiles.length} of ${files.length} shown`}
        action={
          <button type="button" onClick={loadFiles} disabled={loading} className="gst-btn gst-btn-ghost gst-btn-sm">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        }
      />

      {loading && files.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="gst-card p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : recentFiles.length === 0 ? (
        <div className="gst-card">
          <EmptyState
            icon={HardDrive}
            tint={SERVICE_META.drive.tint}
            title="No files synced yet"
            description="Click Refresh to list your recent Drive files. Files created or uploaded through GSTPilot will appear here automatically."
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recentFiles.map((f, i) => {
            const kind = classifyFile(f.mimeType);
            const { icon: Icon, tint } = fileIcon(kind);
            const name = String(f.name ?? 'Untitled');
            const modified = formatDateShort(String(f.modifiedTime ?? ''));
            return (
              <a
                key={String(f.id)}
                href={typeof f.webViewLink === 'string' ? f.webViewLink : undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="gst-card gst-card-hover gst-animate-in block p-4"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: `${tint}14`, border: `1px solid ${tint}33` }}>
                    <Icon className="h-5 w-5" style={{ color: tint }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{name}</div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{String(f.mimeType ?? 'file')}</div>
                    {modified ? <div className="mt-1 text-[11px] text-muted-foreground/70">Modified {modified}</div> : null}
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                </div>
              </a>
            );
          })}
        </div>
      )}

      {/* Shared files */}
      {sharedFiles.length > 0 ? (
        <>
          <SectionHeader
            icon={Share2}
            tint="#A855F7"
            title="Shared With You"
            description={`${sharedFiles.length} files`}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sharedFiles.slice(0, 6).map((f, i) => {
              const kind = classifyFile(f.mimeType);
              const { icon: Icon, tint } = fileIcon(kind);
              return (
                <a
                  key={String(f.id)}
                  href={typeof f.webViewLink === 'string' ? f.webViewLink : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gst-card gst-card-hover gst-animate-in block p-4"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: `${tint}14`, border: `1px solid ${tint}33` }}>
                      <Icon className="h-5 w-5" style={{ color: tint }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{String(f.name ?? 'Untitled')}</div>
                      <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[#A855F7]">
                        <Share2 className="h-3 w-3" /> Shared
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

// ─── Docs Tab ────────────────────────────────────────────────────────────────
//
// Sections:
//   • Create New card (title + body, calls existing docsCreate)
//   • AI Generated Reports (one-tap templates for GST summaries — fills the
//     create form using existing docsCreate)
//   • Recent Documents grid (filtered Drive files of Google Docs mime type)

const DOC_TEMPLATES: Array<{
  id: string;
  label: string;
  icon: LucideIcon;
  tint: string;
  title: string;
  content: string;
}> = [
  {
    id: 'gstr1',
    label: 'GSTR-1 Summary',
    icon: FileSignature,
    tint: '#2563EB',
    title: 'GSTR-1 Summary — Current Tax Period',
    content: 'Outward Supplies\nTotal taxable value: ₹X\nIntegrated tax: ₹Y\nCentral tax: ₹Z\nState tax: ₹W\n\nNotes\n• B2B invoices: N\n• B2C invoices: M\n• Credit notes: K\n\nPrepared by GSTPilot Compliance Desk',
  },
  {
    id: 'pnl',
    label: 'P&L Statement',
    icon: TrendingUp,
    tint: '#34A853',
    title: 'Profit & Loss Statement',
    content: 'Revenue\nGross revenue: ₹X\nReturns: ₹Y\nNet revenue: ₹Z\n\nExpenses\nCost of goods sold: ₹A\nOperating expenses: ₹B\n\nNet profit: ₹C',
  },
  {
    id: 'invoice',
    label: 'Invoice Summary',
    icon: Receipt,
    tint: '#F59E0B',
    title: 'Invoice Summary — Monthly',
    content: 'Total invoices issued: N\nTotal value: ₹X\nPaid: ₹Y\nOutstanding: ₹Z\n\nTop clients\n1. ...\n2. ...\n3. ...',
  },
];

function DocsTab() {
  const { docsCreate, driveFiles, pending } = useGoogleWorkspace();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [result, setResult] = useState<ActionResult | null>(null);
  const [docLink, setDocLink] = useState<string | null>(null);
  const [files, setFiles] = useState<Array<Record<string, unknown>>>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const filesFiredRef = useRef(false);

  const loadFiles = useCallback(async () => {
    setLoadingFiles(true);
    const res = await driveFiles();
    setFiles(res.ok && res.data ? (res.data as { files: Array<Record<string, unknown>> }).files : []);
    setLoadingFiles(false);
  }, [driveFiles]);

  useEffect(() => {
    if (filesFiredRef.current) return;
    filesFiredRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFiles();
  }, [loadFiles]);

  const handleCreate = useCallback(async () => {
    if (!title) { setResult({ ok: false, message: 'Title required.' }); return; }
    const paragraphs = content.split('\n').filter(Boolean).map((text, i) => ({
      text,
      heading: i === 0 ? ('HEADING_1' as const) : undefined,
    }));
    const res = await docsCreate({ title, paragraphs });
    if (res.ok && res.data) {
      const docId = (res.data as { document?: { documentId?: string } }).document?.documentId;
      const link = docId ? `https://docs.google.com/document/d/${docId}/edit` : null;
      setDocLink(link);
      setResult({ ok: true, message: `Document "${title}" created in Google Docs.`, data: res.data });
      void loadFiles();
    } else {
      setResult({ ok: false, message: res.error ?? 'Failed to create document.' });
    }
  }, [title, content, docsCreate, loadFiles]);

  const applyTemplate = useCallback((t: typeof DOC_TEMPLATES[number]) => {
    setTitle(t.title);
    setContent(t.content);
    setResult({ ok: true, message: `Template "${t.label}" loaded.` });
  }, []);

  const docs = files.filter((f) => classifyFile(f.mimeType) === 'doc').slice(0, 8);

  return (
    <div className="space-y-4">
      {/* Top row — Create + AI Templates */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Create New */}
        <div className="gst-card gst-animate-in p-5" style={{ animationDelay: '40ms' }}>
          <SectionHeader
            icon={FileText}
            tint={SERVICE_META.docs.tint}
            title="Create New Document"
            description="Generate a Google Doc with title + body"
          />
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="gst-label">Document title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Invoice — Sharma Enterprises" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="gst-label">Content (one paragraph per line)</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={'Line 1 — heading\nLine 2 — body paragraph'} className="min-h-[140px] text-sm" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={handleCreate} disabled={pending} className="gst-btn gst-btn-primary gst-btn-sm">
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus className="h-3.5 w-3.5" />}
                Create Google Doc
              </button>
              {docLink ? (
                <a href={docLink} target="_blank" rel="noopener noreferrer" className="gst-btn gst-btn-ghost gst-btn-sm">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in Docs
                </a>
              ) : null}
            </div>
            <ResultBanner result={result} />
          </div>
        </div>

        {/* AI Generated Reports */}
        <div className="gst-card gst-animate-in relative overflow-hidden p-5" style={{ animationDelay: '80ms' }}>
          <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-[#4285F4]/10 blur-3xl" />
          <div className="relative">
            <SectionHeader
              icon={Sparkles}
              tint="#8B5CF6"
              title="AI Generated Reports"
              description="One-tap templates that auto-fill the create form"
            />
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {DOC_TEMPLATES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="group flex flex-col items-start gap-2 rounded-lg border border-[#1F1F1F] bg-[#0F0F0F] p-3 text-left transition-all hover:border-[#2A2A2A] hover:bg-[#111111]"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md" style={{ background: `${t.tint}14`, border: `1px solid ${t.tint}33` }}>
                      <Icon className="h-4 w-4" style={{ color: t.tint }} />
                    </div>
                    <span className="text-xs font-medium text-foreground">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Documents */}
      <SectionHeader
        icon={FileText}
        tint={SERVICE_META.docs.tint}
        title="Recent Documents"
        description={`${docs.length} Google Docs found in Drive`}
        action={
          <button type="button" onClick={loadFiles} disabled={loadingFiles} className="gst-btn gst-btn-ghost gst-btn-sm">
            {loadingFiles ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        }
      />

      {loadingFiles && docs.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="gst-card p-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="mt-3 h-3 w-3/4" />
              <Skeleton className="mt-2 h-2.5 w-1/2" />
            </div>
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="gst-card">
          <EmptyState
            icon={FileText}
            tint={SERVICE_META.docs.tint}
            title="No documents found"
            description="Use the Create New card above to generate your first Google Doc through GSTPilot."
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {docs.map((f, i) => {
            const name = String(f.name ?? 'Untitled');
            const modified = formatDateShort(String(f.modifiedTime ?? ''));
            return (
              <a
                key={String(f.id)}
                href={typeof f.webViewLink === 'string' ? f.webViewLink : undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="gst-card gst-card-hover gst-animate-in block p-4"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4285F4]/14 ring-1 ring-[#4285F4]/30">
                  <FileText className="h-5 w-5 text-[#4285F4]" />
                </div>
                <div className="mt-3 truncate text-sm font-medium text-foreground">{name}</div>
                {modified ? <div className="mt-1 text-[11px] text-muted-foreground/70">{modified}</div> : null}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sheets Tab ──────────────────────────────────────────────────────────────
//
// Sections:
//   • Export to Sheets card (title + CSV, calls existing sheetsExport)
//   • Financial Sheets / GST Sheets split — categorizes recent spreadsheets
//     found in Drive by name keywords ("gst"/"gstr" vs others)
//   • Open Sheets CTA

function SheetGrid({
  list,
  tint,
  emptyLabel,
}: {
  list: Array<Record<string, unknown>>;
  tint: string;
  emptyLabel: string;
}) {
  if (list.length === 0) {
    return (
      <div className="gst-card">
        <EmptyState
          icon={FileSpreadsheet}
          tint={tint}
          title={emptyLabel}
          description="Use the export card above to push CSV data into a new Google Sheet."
        />
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {list.slice(0, 8).map((f, i) => {
        const name = String(f.name ?? 'Untitled');
        const modified = formatDateShort(String(f.modifiedTime ?? ''));
        return (
          <a
            key={String(f.id)}
            href={typeof f.webViewLink === 'string' ? f.webViewLink : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="gst-card gst-card-hover gst-animate-in block p-4"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `${tint}14`, border: `1px solid ${tint}33` }}>
              <FileSpreadsheet className="h-5 w-5" style={{ color: tint }} />
            </div>
            <div className="mt-3 truncate text-sm font-medium text-foreground">{name}</div>
            {modified ? <div className="mt-1 text-[11px] text-muted-foreground/70">{modified}</div> : null}
          </a>
        );
      })}
    </div>
  );
}

function SheetsTab() {
  const { sheetsExport, driveFiles, pending } = useGoogleWorkspace();
  const [title, setTitle] = useState('');
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<ActionResult | null>(null);
  const [sheetLink, setSheetLink] = useState<string | null>(null);
  const [files, setFiles] = useState<Array<Record<string, unknown>>>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const filesFiredRef = useRef(false);

  const loadFiles = useCallback(async () => {
    setLoadingFiles(true);
    const res = await driveFiles();
    setFiles(res.ok && res.data ? (res.data as { files: Array<Record<string, unknown>> }).files : []);
    setLoadingFiles(false);
  }, [driveFiles]);

  useEffect(() => {
    if (filesFiredRef.current) return;
    filesFiredRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFiles();
  }, [loadFiles]);

  const handleExport = useCallback(async () => {
    if (!title || !csv) { setResult({ ok: false, message: 'Title + CSV data required.' }); return; }
    const rows = csv.trim().split('\n').map((line) => ({ values: line.split(',').map((c) => c.trim()) }));
    const res = await sheetsExport({ title, rows });
    if (res.ok && res.data) {
      const link = (res.data as { spreadsheet?: { webViewLink?: string } }).spreadsheet?.webViewLink ?? null;
      setSheetLink(link);
      setResult({ ok: true, message: `Spreadsheet "${title}" created with ${rows.length} rows.`, data: res.data });
      void loadFiles();
    } else {
      setResult({ ok: false, message: res.error ?? 'Failed to export to Sheets.' });
    }
  }, [title, csv, sheetsExport, loadFiles]);

  const sheets = files.filter((f) => classifyFile(f.mimeType) === 'sheet');
  const gstSheets = sheets.filter((f) => /gst|gstr|tax/i.test(String(f.name ?? '')));
  const financialSheets = sheets.filter((f) => !/gst|gstr|tax/i.test(String(f.name ?? '')));

  return (
    <div className="space-y-4">
      {/* Export card */}
      <div className="gst-card gst-animate-in p-5" style={{ animationDelay: '40ms' }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeader
            icon={Sheet}
            tint={SERVICE_META.sheets.tint}
            title="Export to Google Sheets"
            description="Create a spreadsheet from CSV (first row = header)"
          />
          <a
            href="https://sheets.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="gst-btn gst-btn-outline gst-btn-sm"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Sheets
          </a>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="gst-label">Spreadsheet title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="GST Report — May 2025" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="gst-label">CSV data</Label>
              <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'Month,Revenue,Tax,Net\nMay,250000,45000,205000'} className="min-h-[140px] font-mono text-xs" />
            </div>
          </div>
          <div className="flex flex-col justify-between gap-3">
            <div className="rounded-lg border border-[#1F1F1F] bg-[#0F0F0F] p-3">
              <div className="gst-caption mb-1.5 uppercase tracking-wider">Tip</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Paste your GSTR-2A reconciliation, invoice register, or P&L as CSV. The first row becomes the header. GSTPilot will create a native Google Sheet you can share with clients.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={handleExport} disabled={pending} className="gst-btn gst-btn-primary gst-btn-sm">
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Export to Sheets
              </button>
              {sheetLink ? (
                <a href={sheetLink} target="_blank" rel="noopener noreferrer" className="gst-btn gst-btn-ghost gst-btn-sm">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open spreadsheet
                </a>
              ) : null}
            </div>
            <ResultBanner result={result} />
          </div>
        </div>
      </div>

      {/* GST Sheets */}
      <SectionHeader
        icon={FileSpreadsheet}
        tint="#2563EB"
        title="GST Sheets"
        description={`${gstSheets.length} spreadsheets matching GST / tax`}
        action={
          <button type="button" onClick={loadFiles} disabled={loadingFiles} className="gst-btn gst-btn-ghost gst-btn-sm">
            {loadingFiles ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        }
      />
      {loadingFiles && sheets.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="gst-card p-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="mt-3 h-3 w-3/4" />
              <Skeleton className="mt-2 h-2.5 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <SheetGrid list={gstSheets} tint="#2563EB" emptyLabel="No GST sheets found" />
      )}

      {/* Financial Sheets */}
      <SectionHeader
        icon={Wallet}
        tint={SERVICE_META.sheets.tint}
        title="Financial Sheets"
        description={`${financialSheets.length} general spreadsheets`}
      />
      <SheetGrid list={financialSheets} tint={SERVICE_META.sheets.tint} emptyLabel="No financial sheets found" />
    </div>
  );
}

// ─── Calendar Tab ────────────────────────────────────────────────────────────
//
// Sections:
//   • Upcoming GST Deadlines (events with GST/GSTR in summary)
//   • CA Meetings (events with CA/auditor/chartered accountant in summary)
//   • Invoice Due Dates (events with invoice/due/payment in summary)
//   • All Meetings (full upcoming list)
//   • Schedule Event card (calls existing calendarCreate)

function EventList({
  list,
  tint,
  icon: Icon,
  emptyTitle,
}: {
  list: Array<Record<string, unknown>>;
  tint: string;
  icon: LucideIcon;
  emptyTitle: string;
}) {
  if (list.length === 0) {
    return (
      <div className="gst-card p-5">
        <EmptyState
          icon={Icon}
          tint={tint}
          title={emptyTitle}
          description="Create an event with a relevant title (e.g. 'GSTR-1 Filing') and it will appear here."
        />
      </div>
    );
  }
  return (
    <div className="gst-card gst-animate-in p-0">
      <ul className="divide-y divide-[#1F1F1F]">
        {list.slice(0, 8).map((e) => {
          const startStr = eventStart(e);
          const d = startStr ? new Date(startStr) : null;
          const day = d ? d.toLocaleDateString([], { day: '2-digit' }) : '—';
          const mon = d ? d.toLocaleDateString([], { month: 'short' }) : '';
          const time = d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          return (
            <li key={String(e.id)} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#0F0F0F]">
              <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg" style={{ background: `${tint}14`, border: `1px solid ${tint}33` }}>
                <span className="text-[11px] font-bold uppercase leading-none" style={{ color: tint }}>{mon}</span>
                <span className="mt-0.5 text-base font-bold leading-none text-foreground">{day}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{String(e.summary ?? '(no title)')}</div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {time ? `${time} · ` : ''}{startStr ? formatDateShort(startStr) : '—'}
                </div>
              </div>
              {e.htmlLink ? (
                <a
                  href={String(e.htmlLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Open in Google Calendar"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CalendarTab() {
  const { calendarEvents, calendarCreate, pending } = useGoogleWorkspace();
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [summary, setSummary] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [attendees, setAttendees] = useState('');
  const hasLoadedRef = useRef(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const res = await calendarEvents(15);
    setEvents(res.ok && res.data ? (res.data as { events: Array<Record<string, unknown>> }).events : []);
    setLoading(false);
  }, [calendarEvents]);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEvents();
  }, [loadEvents]);

  const handleCreate = useCallback(async () => {
    if (!summary || !start || !end) { setResult({ ok: false, message: 'Summary, start and end are required.' }); return; }
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

  const gstDeadlines = events.filter((e) => /gst|gstr/i.test(String(e.summary ?? '')));
  const caMeetings = events.filter((e) => /\bca\b|chartered accountant|auditor/i.test(String(e.summary ?? '')));
  const invoiceDues = events.filter((e) => /invoice|due|payment/i.test(String(e.summary ?? '')));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Left column — GST Deadlines + CA Meetings + Invoice Due Dates */}
      <div className="space-y-4 lg:col-span-2">
        <SectionHeader
          icon={CalendarClock}
          tint="#FBBC05"
          title="Upcoming GST Deadlines"
          description={`${gstDeadlines.length} GST-related events`}
        />
        {loading && events.length === 0 ? (
          <div className="gst-card p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2.5 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EventList list={gstDeadlines} tint="#FBBC05" icon={CalendarClock} emptyTitle="No GST deadlines" />
        )}

        <SectionHeader
          icon={Users}
          tint="#4285F4"
          title="CA Meetings"
          description={`${caMeetings.length} meetings with CA / auditor`}
        />
        <EventList list={caMeetings} tint="#4285F4" icon={Users} emptyTitle="No CA meetings scheduled" />

        <SectionHeader
          icon={Receipt}
          tint="#EF4444"
          title="Invoice Due Dates"
          description={`${invoiceDues.length} invoice / payment reminders`}
        />
        <EventList list={invoiceDues} tint="#EF4444" icon={Receipt} emptyTitle="No invoice due dates" />

        <SectionHeader
          icon={Calendar}
          tint={SERVICE_META.calendar.tint}
          title="All Upcoming Meetings"
          description={`${events.length} events synced`}
          action={
            <button type="button" onClick={loadEvents} disabled={loading} className="gst-btn gst-btn-ghost gst-btn-sm">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </button>
          }
        />
        <EventList list={events} tint={SERVICE_META.calendar.tint} icon={Calendar} emptyTitle="No upcoming events" />
      </div>

      {/* Right column — Schedule Event */}
      <div className="space-y-4">
        <div className="gst-card gst-animate-in sticky top-4 p-5" style={{ animationDelay: '60ms' }}>
          <SectionHeader
            icon={CalendarPlus}
            tint={SERVICE_META.calendar.tint}
            title="Schedule Event"
            description="Create with email reminders"
          />
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="gst-label">Event summary</Label>
              <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="GSTR-1 Filing Reminder" className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="gst-label">Start</Label>
                <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="gst-label">End</Label>
                <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="gst-label">Attendees (comma-separated)</Label>
              <Input value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="ca@firm.com, client@biz.in" className="h-9" />
            </div>
            <button type="button" onClick={handleCreate} disabled={pending} className="gst-btn gst-btn-primary gst-btn-sm w-full">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
              Create Event
            </button>
            <ResultBanner result={result} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function GoogleWorkspacePage() {
  const { organization } = useOrg();
  const { status, connect, pending } = useGoogleWorkspace();
  const [tab, setTab] = useState<ServiceTab>('gmail');
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
      if (params.get('google_connected') || params.get('google_error')) {
        const clean = window.location.pathname;
        window.history.replaceState({}, '', clean);
      }
    } catch {
      /* SSR guard */
    }
  }, []);

  const handleConnect = useCallback(async () => {
    const { authUrl, error } = await connect();
    if (error) {
      setOauthBanner({ ok: false, message: error });
      return;
    }
    if (authUrl) window.location.href = authUrl;
  }, [connect]);

  // Badges for tabs (derived from status only — actual counts come from each tab)
  const tabBadges: Partial<Record<ServiceTab, number>> = {};

  return (
    <div className="gst-container-wide min-h-screen py-6 md:py-8 flex flex-col gap-6">
      {/* Page header */}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A0A0A] ring-1 ring-[#1F1F1F]">
            <GoogleGlyph className="h-6 w-6" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="gst-page-title">Google Workspace</h1>
            <span className="gst-status gst-status-info">Enterprise Integration</span>
          </div>
        </div>
        <p className="gst-description max-w-3xl">
          {organization?.name ? `${organization.name} · ` : ''}
          Premium integration for Gmail, Drive, Docs, Sheets &amp; Calendar — secured with AES-256-GCM encrypted OAuth tokens.
        </p>
      </header>

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
            <button onClick={() => setOauthBanner(null)} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Overview header */}
      <ConnectionHeader />

      {/* Stats row (when connected) */}
      {status?.connected ? <OverviewStatsRow /> : null}

      {/* Tabs + content OR not-connected gate */}
      <NotConnectedGate onConnect={handleConnect}>
        <div className="flex flex-col gap-6">
          <PremiumTabs tab={tab} setTab={setTab} badges={tabBadges} />

          {/* Active tab description */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-[#60A5FA]" />
            <span>{SERVICE_META[tab].description}</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {tab === 'gmail' && <GmailTab />}
              {tab === 'drive' && <DriveTab />}
              {tab === 'docs' && <DocsTab />}
              {tab === 'sheets' && <SheetsTab />}
              {tab === 'calendar' && <CalendarTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </NotConnectedGate>

      {/* Footer note */}
      <div className="mt-auto flex items-center justify-center gap-2 pt-6 text-[11px] text-muted-foreground">
        <Lock className="h-3 w-3 text-emerald-500" />
        <span>Tokens are AES-256-GCM encrypted at rest · Only your organization can access them · Disconnect anytime to revoke access</span>
      </div>
    </div>
  );
}
