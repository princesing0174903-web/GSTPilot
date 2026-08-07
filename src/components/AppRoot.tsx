'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GSTPilot — AppRoot (chunk-split entry)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This module is the REAL entry point of the GSTPilot SPA. It is loaded
 * on-demand via `next/dynamic` from `src/app/page.tsx` so that the initial
 * `/` compile only processes the tiny page.tsx + layout.tsx + globals.css.
 *
 * MEMORY-SPLIT ARCHITECTURE (fixes 4 GB sandbox OOM):
 *
 *   page.tsx  ──dynamic──▶  AppRoot (THIS FILE — ultra light, no Firebase)
 *                              │
 *                              ├─ <ProvidersLazy>  (static import, light)
 *                              │      │
 *                              │      └─ useEffect ▶ import('providers')  ← chunk A
 *                              │           (Firebase + AuthContext + OrgContext)
 *                              │           children render ONLY after Providers mounts
 *                              │
 *                              └─ <AppRouter>  ──next/dynamic──▶  chunk B
 *                                       (contexts + Landing/Login/Dashboard dynamic imports)
 *                                       Dashboard views are themselves lazy inside AppRouter
 *
 * Because ProvidersLazy gates its children, <AppRouter/> is NOT rendered
 * (and therefore NOT imported) until the Providers tree is fully mounted.
 * This means webpack emits at least THREE independent chunks for the heavy
 * graph, so peak compile memory stays well under the sandbox limit.
 *
 * Flow:
 *   Landing Page → Sign In → Onboarding (first run) → Dashboard → Oracle
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import dynamic from 'next/dynamic';
import { PremiumGlobalLoading } from '@/components/ui/premium-loading';
import { ProvidersLazy } from '@/components/providers-lazy';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// ── Loading placeholder (premium full-screen splash) ─────────────────────────
const PageLoader = () => <PremiumGlobalLoading />;

// ── AppRouter is loaded as its own chunk. It only renders after ProvidersLazy
//    has mounted the Providers tree (ProvidersLazy gates children rendering),
//    so useAuth()/useOrg()/useApp() are guaranteed to be available.
const AppRouter = dynamic(
  () => import('@/components/AppRouter').then((m) => ({ default: m.AppRouter })),
  { ssr: false, loading: () => <PageLoader /> },
);

export function AppRoot() {
  return (
    // POLISH-04: wrap the entire authenticated app in a top-level error
    // boundary. Any uncaught render error in the React tree (after hydration)
    // shows a premium full-page error card instead of a white screen.
    <ErrorBoundary>
      <ProvidersLazy>
        <AppRouter />
      </ProvidersLazy>
    </ErrorBoundary>
  );
}

export default AppRoot;
