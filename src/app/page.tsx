'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Root Page (Oracle Preview Mode)
// ═══════════════════════════════════════════════════════════════════════════════
// Renders the OraclePreviewApp — a lightweight entry that renders Oracle AI
// directly with a local demo workspace, bypassing the heavy DashboardShell
// (which OOM-kills the 4 GB dev sandbox during compile).
//
// The original full app is at src/components/AppRoot.tsx and can be restored
// by swapping the import below.
// ═══════════════════════════════════════════════════════════════════════════════

import dynamic from 'next/dynamic';

const OraclePreviewApp = dynamic(
  () => import('@/components/OraclePreviewApp').then((m) => m.OraclePreviewApp),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl glass-surface motion-pulse">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-sm font-medium text-muted-foreground">Loading GSTPilot Oracle…</span>
        </div>
      </div>
    ),
  },
);

export default function Home() {
  return <OraclePreviewApp />;
}
