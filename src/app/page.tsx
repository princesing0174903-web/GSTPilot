'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GSTPilot Infinity™ — Root Page (ultra-light bootstrap)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This file is INTENTIONALLY minimal. It renders a static branded loader and
 * uses `next/dynamic` with `ssr: false` to load the real app. The SSR renders
 * only the loader; the heavy <AppRoot /> chunk (Providers + AppRouter + all
 * contexts + Firebase + 150 dashboard views) is compiled and loaded on the
 * client only, keeping the SSR pass fast.
 *
 * WHY: The 4 GB sandbox OOM-kills the dev server when the root route pulls in
 * the full GSTPilot dependency tree synchronously. By keeping page.tsx to a
 * single dynamic import, the SSR compile is fast and the heavy client chunk
 * compiles in a separate webpack pass.
 */

import dynamic from 'next/dynamic';
import { Zap } from 'lucide-react';

// ── Full-page branded loader (SSR'd so it paints instantly) ──────────────────
function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 border border-white/10 motion-pulse">
          <Zap className="h-7 w-7 text-emerald-400" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-base font-semibold text-white tracking-tight">
            GSTPilot<span className="text-emerald-400">™</span>
          </span>
          <span className="text-xs text-white/45 font-medium">The Financial Brain of India</span>
        </div>
        <div className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-white/5">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AppRoot — the real SPA entry. ssr:false so the heavy chunk compiles and
// loads on the client only, keeping the SSR pass light.
// ═══════════════════════════════════════════════════════════════════════════════
const AppRoot = dynamic(() => import('@/components/AppRoot'), {
  loading: FullPageLoader,
  ssr: false,
});

export default function Home() {
  return <AppRoot />;
}
