/* eslint-disable react-hooks/set-state-in-effect -- This component's purpose is to ping the server and setState based on the result. The setState happens asynchronously in fetch .then()/.catch(), not synchronously in the effect body, so it cannot cause cascading renders. */
'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Dev Server Reconnect Overlay (Phase Gamma: Preview Stability)
//
// In development (and in the sandbox preview), the Next.js dev server may
// restart briefly while recompiling or when the OOM watchdog recycles the
// process. During that window the browser shows an ugly "This site can't be
// reached / ERR_CONNECTION_REFUSED" page — which destroys user trust.
//
// This component sits at the root of the app and pings a lightweight endpoint
// every 4 seconds. When the ping fails, a premium full-screen overlay is shown
// with the GSTPilot brand, a "Reconnecting…" message, and an animated pulse.
// The moment the server is back, the overlay fades away and the app is visible
// again — no manual refresh required.
//
// In production builds this component renders nothing (the overlay never shows
// because the server is always up).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, RefreshCw } from 'lucide-react';

type ConnectionState = 'connected' | 'reconnecting';

// PERF: Polling the dev server every 5s generated 445+ log entries per session
// and kept the dev server's compile queue busy. Raised to 15s — still catches
// genuine server restarts within ~30s (2 failures × 15s) but eliminates the
// log spam and unnecessary compile churn. In production builds this component
// is a no-op (the overlay never shows because the server is always up), so the
// interval only matters in dev.
const PING_INTERVAL_MS = 15_000;
const PING_TIMEOUT_MS = 8_000;
// Require 2 consecutive failures before showing the overlay. This prevents
// the overlay from flickering during brief compile pauses (which can take
// 5-10s in dev mode) while still catching genuine server restarts within
// ~30 seconds.
const FAILURE_THRESHOLD = 2;

export function DevServerReconnect() {
  const [state, setState] = useState<ConnectionState>('connected');
  const [attempt, setAttempt] = useState(0);
  const failuresRef = useRef(0);

  const ping = useCallback(async () => {
    try {
      // Use a HEAD request to the homepage — cheapest possible check that the
      // dev server is alive and responding. Abort after 8s so a hanging
      // connection doesn't block the next retry.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
      const res = await fetch('/', {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok || res.status < 500) {
        failuresRef.current = 0;
        setState('connected');
        setAttempt(0);
      } else {
        failuresRef.current += 1;
        if (failuresRef.current >= FAILURE_THRESHOLD) {
          setState('reconnecting');
          setAttempt((a) => a + 1);
        }
      }
    } catch {
      // Network error = server is down / restarting.
      failuresRef.current += 1;
      if (failuresRef.current >= FAILURE_THRESHOLD) {
        setState('reconnecting');
        setAttempt((a) => a + 1);
      }
    }
  }, []);

  useEffect(() => {
    // ── Production no-op ────────────────────────────────────────────────
    // In production builds the server is always up; the poll is pure waste.
    // Skip mounting the interval entirely so this component is a no-op.
    if (process.env.NODE_ENV === 'production') return;

    // Ping immediately on mount, then on an interval. The ping is an async
    // network call — setState happens in the .then()/.catch(), not
    // synchronously in the effect body, so this doesn't cause cascading renders.
    void ping();
    const id = setInterval(ping, PING_INTERVAL_MS);
    return () => clearInterval(id);
  }, [ping]);

  return (
    <AnimatePresence>
      {state === 'reconnecting' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-md"
          role="alertdialog"
          aria-live="assertive"
          aria-label="Reconnecting to GSTPilot server"
        >
          <div className="flex flex-col items-center gap-6 px-6 text-center">
            {/* ── Animated brand badge ── */}
            <div className="relative">
              <div
                aria-hidden
                className="absolute inset-0 -z-10 rounded-3xl bg-emerald-500/20 blur-2xl scale-150"
              />
              <motion.div
                animate={{
                  scale: [1, 1.08, 1],
                  opacity: [0.7, 1, 0.7],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="flex h-16 w-16 items-center justify-center rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5"
              >
                <Zap className="h-7 w-7 text-emerald-300" strokeWidth={1.75} />
              </motion.div>
            </div>

            {/* ── Copy ── */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold tracking-tight text-white">
                Reconnecting to GSTPilot
              </h2>
              <p className="max-w-xs text-sm text-zinc-400">
                The server is briefly restarting. This usually takes a few
                seconds — you&apos;ll be back automatically.
              </p>
            </div>

            {/* ── Spinner + attempt counter ── */}
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
              {attempt > 1 && (
                <p className="text-xs text-zinc-500">
                  Attempt {attempt}…
                </p>
              )}
            </div>

            {/* ── Brand footer ── */}
            <p className="mt-4 text-[11px] font-medium uppercase tracking-widest text-zinc-600">
              GSTPilot Infinity™
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default DevServerReconnect;
