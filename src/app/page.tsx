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
import { withRetry } from '@/lib/dynamic-retry';
import { PremiumGlobalLoading } from '@/components/ui/premium-loading';

const AppRoot = dynamic(
  withRetry(() => import('@/components/AppRoot').then((m) => m.AppRoot)),
  {
    ssr: false,
    loading: () => <PremiumGlobalLoading />,
  },
);

export default function Home() {
  return <AppRoot />;
}
