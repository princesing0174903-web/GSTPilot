'use client';

/**
 * Lazy wrapper around the heavy Providers tree.
 *
 * WHY: The real Providers (@/components/providers) synchronously imports
 * Firebase, three React contexts, TanStack Query, and the GSTPilot Oracle
 * component. Compiling that entire graph during the `/` cold-compile spikes
 * RSS past the 4 GB sandbox cgroup limit and gets the dev server OOM-killed.
 *
 * By deferring the real Providers to a client-side dynamic import, the initial
 * `/` compile only processes this thin shell (React + a spinner). The heavy
 * Firebase/context graph compiles AFTER hydration, when the browser has
 * already painted the branded loading screen — no user-facing behavior change.
 */

import dynamic from 'next/dynamic';
import { Zap } from 'lucide-react';

const Providers = dynamic(
  () => import('@/components/providers').then((m) => m.Providers),
  {
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
  }
);

export function ProvidersLazy({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
