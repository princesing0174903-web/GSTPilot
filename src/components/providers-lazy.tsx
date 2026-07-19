'use client'

/**
 * Lazy wrapper around the heavy Providers tree.
 * Uses useEffect + useState instead of next/dynamic so the server-side
 * compile of this file processes ZERO heavy imports.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Zap } from 'lucide-react'

function ProvidersLoader() {
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
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 700 }}>
        <Zap size={18} style={{ color: '#3B82F6' }} />
        <span>GSTPilot™</span>
      </div>
      <div style={{ width: '24px', height: '24px', border: '2px solid rgba(59,130,246,0.2)', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'gstpilot-providers-spin 0.7s linear infinite' }} />
      <style>{`@keyframes gstpilot-providers-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export function ProvidersLazy({ children }: { children: ReactNode }) {
  const [Providers, setProviders] = useState<React.ComponentType<{ children: ReactNode }> | null>(null)

  useEffect(() => {
    import('@/components/providers')
      .then((m) => setProviders(() => m.Providers))
      .catch((err) => console.error('[GSTPilot] Providers load failed:', err))
  }, [])

  if (!Providers) return <ProvidersLoader />
  return <Providers>{children}</Providers>
}
