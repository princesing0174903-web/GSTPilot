'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Root Page
// ═══════════════════════════════════════════════════════════════════════════════
// Full SaaS application entry point.
//
// Flow:
//   Landing Page → Sign In → Onboarding (first run) → Dashboard → Oracle
//
// AppRoot is loaded via `next/dynamic` so the initial server render stays
// tiny (just the loading splash). The heavy Providers + AppRouter + contexts
// compile on the client after hydration. The dashboard views inside
// AppRouter are themselves lazy, so they only compile when the user
// authenticates and navigates to them.
//
// The Oracle Preview (lightweight, Firebase-free Oracle-only entry) remains
// available as a separate development route at `/oracle-preview`.
// ═══════════════════════════════════════════════════════════════════════════════

import dynamic from 'next/dynamic';
import { Zap } from 'lucide-react';
import { withRetry } from '@/lib/dynamic-retry';

const AppRoot = dynamic(
  withRetry(() => import('@/components/AppRoot').then((m) => m.AppRoot)),
  {
    ssr: false,
    loading: () => (
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
    ),
  },
);

export default function Home() {
  return <AppRoot />;
}
