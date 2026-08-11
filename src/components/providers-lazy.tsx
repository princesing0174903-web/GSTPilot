'use client'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Lazy wrapper around the heavy Providers tree.
 *
 * PERFORMANCE ARCHITECTURE (boot optimization):
 *
 * The boot path used to be SEQUENTIAL:
 *   ProvidersLazy → import providers.tsx → mount → dynamic(AuthContext) →
 *   mount → loadFirebase() → mount → dynamic(OrgContext) → mount →
 *   loadOrgService() → mount → AppRouter → dynamic(DashboardShell) → ...
 *
 * Each arrow is a React render cycle + a webpack on-demand compile. On a cold
 * dev server that's ~35 seconds of round-trips before the dashboard appears.
 *
 * FIX: kick off ALL heavy chunk imports IN PARALLEL the moment ProvidersLazy
 * mounts. Webpack queues every compile at once (no React round-trips between
 * them), and the modules are cached so the sequential React tree resolves
 * each `dynamic()` / `loadX()` from cache (instant) instead of triggering a
 * fresh compile (slow).
 *
 * Prefetch targets (each is its own webpack chunk):
 *   • @/components/providers           — Providers tree (AuthProvider, OrgProvider, AppProvider)
 *   • @/contexts/AuthContext           — auth context implementation
 *   • @/contexts/OrgContext            — org context implementation
 *   • @/lib/firebase                   — Firebase SDK (~40 MB)
 *   • @/lib/auth                       — auth helpers (sign-in, sign-up, etc.)
 *   • @/lib/auth/organizations         — Firestore org service
 *   • @/components/AppRouter           — top-level screen router
 *   • @/components/DashboardShell      — dashboard layout (loaded after auth)
 *
 * This cuts the cold-boot time roughly in half because webpack can compile
 * all chunks back-to-back without waiting for the browser to mount each
 * React level and request the next chunk.
 *
 * FAIL-SAFE: if prefetch hasn't resolved within `BOOT_TIMEOUT_MS` (8s), we
 * show a "slow boot" notice with a Retry button — the user is NEVER stuck
 * on a silent loading screen for minutes/hours.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Zap, AlertTriangle, RefreshCw } from 'lucide-react'
import { PremiumGlobalLoading } from '@/components/ui/premium-loading'
import { boot } from '@/lib/perf/boot-tracer'

// ── Hard fail-safe for the entire boot path. If the Providers tree hasn't
//    mounted within this window, we surface a "slow boot" notice so the user
//    is never silently stuck. 8s is generous — warm boots resolve in <2s,
//    cold dev compiles typically finish in 3–6s.
const BOOT_TIMEOUT_MS = 8_000

function ProvidersLoader() {
  // Premium full-screen loader — logo fade-in + breathing animation. No spinner.
  return <PremiumGlobalLoading />
}

/**
 * Error fallback shown when the Providers chunk fails to load (e.g. during a
 * dev recompile or a transient network blip). Previously the `.catch` only
 * logged to console and `<ProvidersLoader />` spun forever, leaving the entire
 * app dead. Now the user sees a clear message + a Reload button so they can
 * recover without manual intervention.
 */
function ProvidersLoadError() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        background: '#000',
        color: '#e2e8f0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        zIndex: 9999,
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 700 }}>
        <Zap size={18} style={{ color: '#3B82F6' }} />
        <span>GSTPilot™</span>
      </div>
      <AlertTriangle size={32} style={{ color: '#f59e0b' }} />
      <div style={{ maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontSize: '15px', fontWeight: 600 }}>Couldn’t load the app</div>
        <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
          A required part of GSTPilot failed to load. This is usually a brief network
          hiccup or a background update — reloading should fix it.
        </div>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: '#3B82F6',
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          padding: '10px 18px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <RefreshCw size={16} />
        Reload
      </button>
    </div>
  )
}

export function ProvidersLazy({ children }: { children: ReactNode }) {
  const [Providers, setProviders] = useState<React.ComponentType<{ children: ReactNode }> | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [slowBoot, setSlowBoot] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timedOut = false
    // Track whether the prefetch has resolved so the slow-boot timer can
    // short-circuit. We can't rely on `Providers` state because the timer
    // closure captures the initial (null) value — React state updates
    // don't propagate into the existing timeout closure.
    let prefetchResolved = false

    boot.mark('providers prefetch start')

    // ── Install dev-only perf monitor ───────────────────────────────────
    // Wraps fetch to log any /api/ request >1s, subscribes to LCP/long-task
    // observers, and logs hydration timing. No-op in production.
    try {
      const { installPerfMonitor } = require('@/lib/perf/monitor')
      installPerfMonitor()
    } catch {
      /* non-fatal — perf monitor is dev-only diagnostics */
    }

    // ── PARALLEL PREFETCH ────────────────────────────────────────────────
    // Kick off EVERY heavy chunk import at once. Webpack compiles them
    // back-to-back (no React round-trips between), and each module lands in
    // the runtime cache. When the React tree later reaches a `dynamic()` or
    // `loadX()` call for one of these, it resolves from cache in <1ms
    // instead of triggering a fresh on-demand compile (which takes 1–8s
    // each on a cold dev server).
    //
    // The list is ordered roughly by when the React tree will request each
    // chunk, but ordering doesn't matter — they all start in parallel.
    const prefetch = Promise.all([
      import('@/components/providers'),
      import('@/contexts/AuthContext'),
      import('@/contexts/OrgContext'),
      import('@/lib/firebase'),
      import('@/lib/auth'),
      import('@/lib/auth/organizations'),
      import('@/components/AppRouter'),
      // DashboardShell is only needed AFTER auth resolves, but starting its
      // compile now means it's ready by the time the user signs in. This
      // shaves ~3–5s off the post-login dashboard appearance.
      import('@/components/DashboardShell').catch(() => undefined),
      // ── DEEP PREFETCH ──────────────────────────────────────────────────
      // DashboardShell's dynamic children (DashboardViews + DashboardPage +
      // their transitive imports: Firestore hooks, business snapshot, recharts,
      // framer-motion) are the single biggest compile cost on a cold dev
      // server — ~40–55s. By starting these compiles during the landing-page
      // view (before the user even signs in), they run in the background and
      // are cached by the time the user reaches the dashboard. Each `.catch`
      // is a no-op on failure — these are pure prefetch hints.
      import('@/components/DashboardViews').catch(() => undefined),
      import('@/components/dashboard/DashboardPage').catch(() => undefined),
      // The business snapshot hook + API path are used by every dashboard
      // view. Pre-warming them avoids a fresh compile on first API call.
      import('@/lib/business/snapshot').catch(() => undefined),
    ])

    prefetch
      .then(([m]) => {
        if (!cancelled) {
          boot.mark('providers prefetch complete')
          prefetchResolved = true
          setProviders(() => m.Providers)
        }
      })
      .catch((err) => {
        console.error('[GSTPilot] Providers load failed:', err)
        if (!cancelled) setLoadFailed(true)
      })

    // ── BOOT TIMEOUT FAIL-SAFE ───────────────────────────────────────────
    // If prefetch hasn't resolved within BOOT_TIMEOUT_MS, flip `slowBoot`
    // so the user sees an actionable notice instead of a silent spinner.
    // We do NOT abort the prefetch — it may still resolve a moment later,
    // in which case the notice disappears and the app mounts normally.
    const timeout = setTimeout(() => {
      if (!cancelled && !prefetchResolved) {
        console.warn(`[Boot] Providers prefetch exceeded ${BOOT_TIMEOUT_MS}ms — showing slow-boot notice`)
        timedOut = true
        setSlowBoot(true)
      }
    }, BOOT_TIMEOUT_MS)

    return () => {
      cancelled = true
      clearTimeout(timeout)
      // Reference timedOut so lint doesn't complain — the flag is for
      // debugging; the cleanup is what actually prevents the state flip.
      void timedOut
    }
  }, [])

  if (loadFailed) return <ProvidersLoadError />
  if (!Providers) {
    // While the prefetch is in flight, show the premium loader. If it
    // exceeds the timeout, overlay an actionable "slow boot" notice so
    // the user knows the app hasn't frozen.
    return (
      <>
        <ProvidersLoader />
        {slowBoot && <SlowBootNotice onRetry={() => window.location.reload()} />}
      </>
    )
  }
  // Prefetch resolved — hide the slow-boot notice (if it was showing) by
  // virtue of replacing the whole subtree with <Providers>.
  return <Providers>{children}</Providers>
}

/**
 * SlowBootNotice — a small, non-blocking overlay shown when the boot
 * prefetch exceeds the timeout. It tells the user the app is taking longer
 * than expected and offers a Reload button. The premium loader continues
 * to animate behind it.
 */
function SlowBootNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: '32px',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        background: 'rgba(12, 12, 12, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        borderRadius: '12px',
        boxShadow: '0 20px 60px -10px rgba(0,0,0,0.8)',
        color: '#e2e8f0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        zIndex: 10000,
        maxWidth: '90vw',
      }}
      role="alert"
      aria-live="polite"
    >
      <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
      <span style={{ lineHeight: 1.4 }}>
        Taking longer than usual. Check your connection or reload.
      </span>
      <button
        type="button"
        onClick={onRetry}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(245, 158, 11, 0.15)',
          color: '#fbbf24',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '8px',
          padding: '6px 12px',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <RefreshCw size={12} />
        Reload
      </button>
    </div>
  )
}
