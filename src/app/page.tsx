'use client'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GSTPilot Infinity™ — Root Page (ultra-thin shell)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This file is INTENTIONALLY minimal — it imports NOTHING heavy. The real
 * routing logic (which imports AuthContext / OrgContext / AppContext and their
 * Firebase dependency tree) lives in @/components/AppRouter and is loaded via
 * next/dynamic with ssr: false.
 *
 * WHY: The 4 GB sandbox cgroup OOM-kills the dev server if the root route's
 * client entry chunk synchronously pulls in Firebase + 3 React contexts.
 * By keeping this shell to a single dynamic import, the initial `/` compile
 * only processes ~30 lines of React. The heavy AppRouter graph compiles as a
 * separate async chunk AFTER the browser has painted the branded loader.
 *
 * No user-facing behavior changes — the loader shows for ~100ms while the
 * AppRouter chunk downloads, then the full app mounts.
 */

import dynamic from 'next/dynamic'
import { Zap } from 'lucide-react'

const AppRouter = dynamic(() => import('@/components/AppRouter'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '18px',
        background:
          'radial-gradient(1200px 600px at 50% -10%, #1e293b 0%, #020617 60%, #000 100%)',
        color: '#e2e8f0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '20px',
          fontWeight: 700,
          letterSpacing: '-0.02em',
        }}
      >
        <Zap
          size={22}
          style={{
            color: '#22d3ee',
            filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.6))',
          }}
        />
        <span>
          GSTPilot<span style={{ color: '#22d3ee' }}>™</span>
        </span>
      </div>
      <div
        style={{
          fontSize: '13px',
          color: '#94a3b8',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        The Financial Brain of India
      </div>
      <div
        style={{
          marginTop: '8px',
          width: '28px',
          height: '28px',
          border: '2px solid rgba(34,211,238,0.2)',
          borderTopColor: '#22d3ee',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  ),
})

export default function Home() {
  return <AppRouter />
}
