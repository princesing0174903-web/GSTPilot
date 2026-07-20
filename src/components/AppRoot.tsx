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
import { Zap } from 'lucide-react';
import { ProvidersLazy } from '@/components/providers-lazy';

// ── Loading placeholder (matches the splash used by page.tsx) ──────────────────
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl glass-surface motion-pulse">
        <Zap className="h-5 w-5 accent-text" />
      </div>
      <span className="text-sm font-medium text-muted-foreground">
        Loading GSTPilot…
      </span>
    </div>
  </div>
);

// ── AppRouter is loaded as its own chunk. It only renders after ProvidersLazy
//    has mounted the Providers tree (ProvidersLazy gates children rendering),
//    so useAuth()/useOrg()/useApp() are guaranteed to be available.
const AppRouter = dynamic(
  () => import('@/components/AppRouter').then((m) => ({ default: m.AppRouter })),
  { ssr: false, loading: () => <PageLoader /> },
);

export function AppRoot() {
  return (
    <ProvidersLazy>
      <AppRouter />
    </ProvidersLazy>
  );
}

export default AppRoot;
