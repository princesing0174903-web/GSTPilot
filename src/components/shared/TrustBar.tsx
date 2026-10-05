'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — TrustBar
// Phase 9 trust indicator: surfaces real connection status, last sync time,
// and recent activity count so users can trust the numbers they see.
//
// Design contract:
//   • Green dot  = Firestore subscription live, data received
//   • Amber dot  = connecting (hook loading=true, no error)
//   • Red dot    = genuine error (permission errors are swallowed by hooks
//                  and never reach here — see use-firestore.ts)
//   • Zinc dot   = no data yet (no error, not loading, but nothing received)
//
// The relative-time label auto-refreshes every 30s so "12s ago" stays accurate
// without re-fetching. Uses framer-motion with the standard ease curve and
// respects the GSTPilot dark-theme palette (emerald/amber/rose/zinc only —
// no indigo, no blue).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wifi, WifiOff, RefreshCw, Activity, Clock, CheckCircle2,
} from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';

// ─── Relative time formatter ─────────────────────────────────────────────────
// Returns "just now" / "12s ago" / "3m ago" / "2h ago" / "4d ago" / etc.

function formatRelativeTime(date: Date | null, now: number): string {
  if (!date) return 'never';
  const diff = now - date.getTime();
  if (diff < 0) return 'just now';
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

// ─── Tick hook: re-render every `intervalMs` so the relative time stays fresh ──

function useNow(intervalMs: number = 30000): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface TrustBarProps {
  /** When the data was last fetched from Firestore (real, from onSnapshot). */
  lastSync?: Date | null;
  /** True when the Firestore subscription is live and has delivered data. */
  connected?: boolean;
  /** True when the subscription is still connecting / loading. */
  connecting?: boolean;
  /** Non-empty when the subscription errored (genuine errors only, not permissions). */
  error?: string | null;
  /** Count of recent activity records (from useFireActivities). */
  activityCount?: number;
  /** Optional refresh callback. If omitted, the refresh button is hidden. */
  onRefresh?: () => void;
  /** Compact variant — smaller padding for tighter layouts. */
  compact?: boolean;
  /** Optional className override. */
  className?: string;
}

const EASE = [0.16, 1, 0.3, 1] as const;

type StatusKind = 'error' | 'connecting' | 'connected' | 'idle';

interface StatusDef {
  label: string;
  dot: string;
  ring: string;
  text: string;
  ping: boolean;
  Icon: typeof Wifi;
}

function deriveStatus(props: TrustBarProps): StatusKind {
  const { error, connecting, connected } = props;
  if (error) return 'error';
  if (connecting) return 'connecting';
  if (connected) return 'connected';
  return 'idle';
}

const STATUS_MAP: Record<StatusKind, StatusDef> = {
  error: {
    label: 'Connection error',
    dot: 'bg-rose-400',
    ring: 'ring-rose-400/20',
    text: 'text-rose-300',
    ping: false,
    Icon: WifiOff,
  },
  connecting: {
    label: 'Connecting…',
    dot: 'bg-amber-400',
    ring: 'ring-amber-400/20',
    text: 'text-amber-300',
    ping: true,
    Icon: RefreshCw,
  },
  connected: {
    label: 'Live',
    dot: 'bg-emerald-400',
    ring: 'ring-emerald-400/20',
    text: 'text-emerald-300',
    ping: false,
    Icon: Wifi,
  },
  idle: {
    label: 'No data yet',
    dot: 'bg-zinc-500',
    ring: 'ring-zinc-500/20',
    text: 'text-zinc-400',
    ping: false,
    Icon: WifiOff,
  },
};

export function TrustBar(props: TrustBarProps) {
  const {
    lastSync,
    activityCount,
    onRefresh,
    compact = false,
    className = '',
  } = props;

  const now = useNow(30000);
  const kind = deriveStatus(props);
  const status = STATUS_MAP[kind];
  const syncLabel = formatRelativeTime(lastSync ?? null, now);
  const recentlySynced =
    kind === 'connected' && lastSync != null && (now - lastSync.getTime()) < 60_000;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={`flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm ${
        compact ? 'px-3 py-1.5' : 'px-4 py-2'
      } ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* ── Connection status indicator ── */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`flex items-center gap-2 rounded-full ring-1 ${status.ring} bg-white/[0.03] ${
              compact ? 'px-2 py-0.5' : 'px-2.5 py-1'
            }`}
          >
            <span className="relative flex h-2 w-2">
              {status.ping && (
                <span
                  className={`absolute inline-flex h-full w-full rounded-full ${status.dot} opacity-60 animate-ping`}
                  aria-hidden
                />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${status.dot}`} />
            </span>
            <status.Icon className={`h-3 w-3 ${status.text}`} />
            <span className={`text-[11px] font-medium ${status.text}`}>{status.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {kind === 'error'
            ? `Firestore error: ${props.error}`
            : kind === 'connecting'
              ? 'Subscribing to Firestore…'
              : kind === 'connected'
                ? 'Real-time Firestore subscription active'
                : 'No Firestore data received yet'}
        </TooltipContent>
      </Tooltip>

      <div className="h-3 w-px bg-white/[0.08]" aria-hidden />

      {/* ── Last sync time (auto-updating) ── */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <Clock className="h-3 w-3 text-zinc-500" />
            <span className="hidden sm:inline">Last sync:</span>
            <span className="font-medium text-zinc-300">{syncLabel}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {lastSync
            ? `Synced at ${lastSync.toLocaleTimeString()}`
            : 'No sync yet — waiting for first data from Firestore'}
        </TooltipContent>
      </Tooltip>

      {/* ── Recent activity count ── */}
      {typeof activityCount === 'number' && (
        <>
          <div className="h-3 w-px bg-white/[0.08]" aria-hidden />
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <Activity className="h-3 w-3 text-zinc-500" />
                <span>
                  {activityCount} {activityCount === 1 ? 'activity' : 'activities'}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Recent activity records streamed from Firestore
            </TooltipContent>
          </Tooltip>
        </>
      )}

      {/* ── Recently-synced checkmark (only when no explicit refresh button) ── */}
      {recentlySynced && !onRefresh && (
        <CheckCircle2
          className="ml-auto h-3.5 w-3.5 text-emerald-400/70"
          aria-label="Recently synced"
        />
      )}

      {/* ── Refresh affordance ── */}
      {onRefresh && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Refresh data"
              className="ml-auto flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-emerald-400/30 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Re-subscribe to Firestore real-time updates
          </TooltipContent>
        </Tooltip>
      )}
    </motion.div>
  );
}

export default TrustBar;
