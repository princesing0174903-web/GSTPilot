'use client'

/**
 * Lazy wrapper around the heavy Providers tree.
 * Uses useEffect + useState instead of next/dynamic so the server-side
 * compile of this file processes ZERO heavy imports.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Zap, AlertTriangle, RefreshCw } from 'lucide-react'
import { PremiumGlobalLoading } from '@/components/ui/premium-loading'

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

  useEffect(() => {
    let cancelled = false
    import('@/components/providers')
      .then((m) => {
        if (!cancelled) setProviders(() => m.Providers)
      })
      .catch((err) => {
        console.error('[GSTPilot] Providers load failed:', err)
        if (!cancelled) setLoadFailed(true)
      })
    return () => { cancelled = true }
  }, [])

  if (loadFailed) return <ProvidersLoadError />
  if (!Providers) return <ProvidersLoader />
  return <Providers>{children}</Providers>
}
