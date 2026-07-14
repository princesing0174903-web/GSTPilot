'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Root Page (Dashboard Home)
// ═══════════════════════════════════════════════════════════════════════════════
// The root route ("/") is the DASHBOARD. It is the canonical home of the app.
// Oracle is a separate, full-page workspace at /oracle — accessible ONLY from
// the left navigation. The dashboard NEVER auto-opens Oracle.
//
// Mounting strategy: AppRoot is lazy-loaded so the initial `/` compile stays
// tiny (Landing/Login/Onboarding routing). The heavy dashboard graph
// (150+ views, Oracle Brain, Command Palette, etc.) is compiled on-demand
// AFTER the user authenticates.
// ═══════════════════════════════════════════════════════════════════════════════

import dynamic from 'next/dynamic';

const AppRoot = dynamic(() => import('@/components/AppRoot').then((m) => m.AppRoot), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl glass-surface motion-pulse">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-sm font-medium text-muted-foreground">Loading GSTPilot…</span>
      </div>
    </div>
  ),
});

export default function Home() {
  return <AppRoot />;
}
