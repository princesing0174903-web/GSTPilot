'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — OfflineBanner
//
// Listens to `navigator.onLine` + window `online`/`offline` events and shows
// a sticky banner at the top of the viewport when the browser loses network.
//
// Uses `useSyncExternalStore` (React 18+) for the online/offline signal —
// the correct pattern for subscribing to browser APIs without triggering
// "setState synchronously within an effect" warnings.
//
// useEffect is used ONLY for side-effects (toast on reconnection), not for
// deriving state.
//
// UX:
//   • Amber (warning, not red) — the app is usable offline for cached data,
//     but writes will be queued / failed.
//   • Dismissible (X button).
//   • Fires a success toast on reconnection.
//   • Does NOT block interaction with the app underneath.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useSyncExternalStore, useState } from 'react';
import { WifiOff, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

// ── External store for navigator.onLine ──────────────────────────────────────

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot(): boolean {
  if (typeof navigator === 'undefined') return true; // SSR: assume online
  return navigator.onLine;
}

function getServerSnapshot(): boolean {
  return true; // SSR: assume online
}

export function OfflineBanner() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [dismissed, setDismissed] = useState<boolean>(false);

  // Fire a toast on reconnection (online transition). Side-effect only —
  // no setState in the effect body (avoids cascading-render warning).
  useEffect(() => {
    if (!isOnline) return;
    const t = setTimeout(() => {
      toast.success('Back online', {
        description: 'Your changes will sync automatically.',
        duration: 3000,
      });
    }, 200);
    return () => clearTimeout(t);
  }, [isOnline]);

  if (isOnline || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-2"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-amber-300 backdrop-blur-md">
        <WifiOff className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">You&rsquo;re offline</p>
          <p className="text-xs text-amber-300/70">
            Some features may be unavailable. Cached data is still visible.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-200 transition hover:bg-amber-500/30"
          aria-label="Retry connection"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-md p-1 text-amber-300/60 transition hover:bg-amber-500/10 hover:text-amber-200"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default OfflineBanner;
