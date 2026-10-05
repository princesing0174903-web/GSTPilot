'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle — Preview Route (/oracle-preview)
// ═══════════════════════════════════════════════════════════════════════════════
// DEVELOPMENT-ONLY lightweight entry that renders the Oracle AI workspace
// directly against a local demo organization, WITHOUT requiring sign-in or
// compiling the heavy DashboardShell + Firebase graph.
//
// This route is intended for quick Oracle iteration / demo purposes. The
// REAL application flow (Landing → Sign In → Dashboard → Oracle) is served
// at `/` via src/app/page.tsx → AppRoot → AppRouter.
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
          <span className="text-sm font-medium text-muted-foreground">
            Loading GSTPilot Oracle…
          </span>
        </div>
      </div>
    ),
  },
);

export default function OraclePreviewPage() {
  return <OraclePreviewApp />;
}
