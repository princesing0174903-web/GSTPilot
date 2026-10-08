'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Notifications Sheet
//
// Stabilization wiring: the top-bar Bell + FloatingDock Notifications buttons
// previously toggled an orphaned `notificationsOpen` state that rendered nothing.
// This sheet connects those buttons to the EXISTING `/api/notifications` backend
// (Prisma `Notification` model + GET/PATCH routes). No new backend, no new data
// model — purely wiring a dead UI affordance to its already-built service.
//
// Features:
//   • Fetches the 20 most recent unread-priority notifications
//   • Per-item mark-as-read (PATCH /api/notifications)
//   • Loading / empty / error states
//   • Slides in from the right (Oracle sidebar auto-closes to avoid overlap)
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, RefreshCw, AlertCircle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface NotificationItem {
  id: string;
  type?: string;
  category?: string;
  title: string;
  message: string;
  priority?: string;
  isRead?: boolean;
  readAt?: string | null;
  actionUrl?: string | null;
  createdAt?: string | null;
  client?: { id: string; tradeName: string; gstin: string; status: string } | null;
}

interface NotificationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional user id to scope the notification query. */
  userId?: string;
}

const PRIORITY_TONE: Record<string, string> = {
  critical: 'border-red-500/30 bg-red-500/[0.06] text-red-300',
  high: 'border-amber-500/30 bg-amber-500/[0.06] text-amber-300',
  medium: 'border-cyan-500/30 bg-cyan-500/[0.06] text-cyan-300',
  low: 'border-white/10 bg-white/[0.03] text-muted-foreground',
};

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationsSheet({ open, onOpenChange, userId }: NotificationsSheetProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (userId) params.set('userId', userId);
      const res = await fetch(`/api/notifications?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { notifications?: NotificationItem[] };
      setItems(json.notifications ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const markRead = useCallback(async (id: string) => {
    setMarkingId(id);
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isRead: true }),
      });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)));
    } catch {
      /* best-effort */
    } finally {
      setMarkingId(null);
    }
  }, []);

  const unreadCount = items.filter((n) => !n.isRead).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 border-white/[0.06] bg-background/95 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10">
                <Bell className="h-4 w-4 text-cyan-300" />
              </div>
              <div>
                <SheetTitle className="text-base">Notifications</SheetTitle>
                <SheetDescription className="text-xs">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                </SheetDescription>
              </div>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:opacity-50"
              aria-label="Refresh notifications"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </SheetHeader>

        <div className="custom-scrollbar max-h-[calc(100vh-8rem)] overflow-y-auto">
          {error ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <button
                onClick={load}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-white/[0.06]"
              >
                Try again
              </button>
            </div>
          ) : loading ? (
            <div className="space-y-2 px-3 py-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-white/[0.05] p-3">
                  <Skeleton className="mb-2 h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04]">
                <CheckCheck className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground">
                GST filing reminders, reconciliation alerts, and compliance notices will appear here.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5 px-3 py-3">
              {items.map((n) => {
                const tone = PRIORITY_TONE[n.priority ?? 'medium'] ?? PRIORITY_TONE.medium;
                return (
                  <li
                    key={n.id}
                    className={cn(
                      'rounded-xl border p-3 transition-colors',
                      n.isRead ? 'border-white/[0.04] bg-transparent' : tone,
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                          {!n.isRead && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground/70">
                          {n.category && (
                            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 uppercase tracking-wide">
                              {n.category}
                            </span>
                          )}
                          {n.client?.tradeName && <span className="truncate">{n.client.tradeName}</span>}
                          {n.createdAt && <span>· {timeAgo(n.createdAt)}</span>}
                        </div>
                      </div>
                      {!n.isRead && (
                        <button
                          onClick={() => markRead(n.id)}
                          disabled={markingId === n.id}
                          className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground disabled:opacity-50"
                          aria-label="Mark as read"
                        >
                          {markingId === n.id ? '…' : 'Mark read'}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default NotificationsSheet;
