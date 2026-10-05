'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// useSafePolling — interval-based polling that NEVER stacks
// ═══════════════════════════════════════════════════════════════════════════════
//
// A drop-in replacement for the manual `setInterval(fn, ms)` pattern that:
//   • Skips a tick if the previous tick is still in flight (no stacking).
//   • Cancels cleanly on unmount.
//   • Optionally re-runs immediately when the window regains focus.
//   • Optionally re-runs when `deps` change (e.g. orgId).
//   • Re-uses an AbortController per tick so the caller can cancel mid-flight.
//
// Usage:
//   useSafePolling(
//     async (signal) => {
//       const res = await fetchWithTimeout('/api/data', { signal, timeoutMs: 15000 });
//       setData(await res.json());
//     },
//     { intervalMs: 60_000, runOnFocus: true, deps: [orgId] },
//   );
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { useMountedRef } from './useMountedRef';

export interface SafePollingOptions {
  /** Interval between ticks in ms. Required. */
  intervalMs: number;
  /** If true, fires immediately on window focus (in addition to the interval). */
  runOnFocus?: boolean;
  /** If true, fires the callback immediately on mount / when deps change. Default true. */
  runImmediately?: boolean;
  /** When any value in this array changes, the polling resets (old interval cleared, new one started). */
  deps?: unknown[];
  /** If false, polling is paused. Default true. */
  enabled?: boolean;
}

export function useSafePolling(
  callback: (signal: AbortSignal) => Promise<void>,
  options: SafePollingOptions,
): void {
  const { intervalMs, runOnFocus = false, runImmediately = true, deps = [], enabled = true } = options;
  const mountedRef = useMountedRef();
  // inFlightRef is the single-flight guard — prevents stacked ticks.
  const inFlightRef = useRef(false);
  // abortRef holds the current tick's AbortController so we can cancel it on unmount.
  const abortRef = useRef<AbortController | null>(null);

  // Keep latest callback in a ref so the interval closure always calls the
  // freshest version (no stale state captures).
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const runTick = async () => {
      // Single-flight: skip if a previous tick is still pending.
      if (inFlightRef.current) return;
      if (!mountedRef.current) return;
      inFlightRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        await callbackRef.current(controller.signal);
      } catch {
        // Swallowed — the callback is responsible for its own error UI.
        // We don't want a failed tick to crash the polling loop.
      } finally {
        inFlightRef.current = false;
        abortRef.current = null;
      }
    };

    if (runImmediately) {
      void runTick();
    }

    const intervalId = setInterval(() => {
      void runTick();
    }, intervalMs);

    let onFocus: (() => void) | null = null;
    if (runOnFocus && typeof window !== 'undefined') {
      onFocus = () => {
        void runTick();
      };
      window.addEventListener('focus', onFocus);
    }

    return () => {
      clearInterval(intervalId);
      if (onFocus && typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
      }
      // Cancel any in-flight tick so the callback's `fetch` aborts.
      if (abortRef.current) {
        abortRef.current.abort();
      }
      inFlightRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, runOnFocus, runImmediately, mountedRef, ...deps]);
}
