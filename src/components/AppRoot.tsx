'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GSTPilot — AppRoot (heavy entry chunk)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This module is the REAL entry point of the GSTPilot SPA. It is loaded
 * on-demand via `next/dynamic` from `src/app/page.tsx` so that the initial
 * `/` compile only processes the tiny page.tsx + layout.tsx + globals.css
 * (≈ 3 seconds) instead of the full 150-view dashboard graph (≈ 60 seconds
 * + OOM kill on the 4 GB sandbox).
 *
 * Once this chunk loads, it mounts:
 *   • <Providers>  — theme, react-query, auth, org, app contexts
 *   • <AppRouter>  — screen routing (landing / login / onboarding / dashboard)
 *
 * The heavy dashboard views (DashboardShell, GSTPilotIntelligence, etc.)
 * remain lazy inside AppRouter so they only compile when the user actually
 * authenticates and enters the app.
 */

import { Providers } from '@/components/providers';
import { AppRouter } from '@/components/AppRouter';

export function AppRoot() {
  return (
    <Providers>
      <AppRouter />
    </Providers>
  );
}

export default AppRoot;
