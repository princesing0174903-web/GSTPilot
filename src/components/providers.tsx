'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Root Providers (chunk-split for low-memory sandbox)
//
// Provider hierarchy (outer → inner):
//   ThemeProvider          — light/dark theming            (static, light)
//   QueryClientProvider    — TanStack Query                (static, light)
//   AuthProvider           — Firebase Auth identity        (DYNAMIC — heavy chunk)
//   OrgProvider            — Current org + members + role  (DYNAMIC — heavy chunk)
//   AppProvider            — View routing / UI state       (static, light)
//
// MEMORY-SPLIT: AuthProvider and OrgProvider both pull in the Firebase SDK
// (~40 MB). By loading them via `next/dynamic`, webpack emits Firebase as its
// own chunk that compiles SEPARATELY from the initial `/` compile. This keeps
// peak compile memory well under the 4 GB sandbox limit.
//
// The providers load sequentially (OrgProvider is a child of AuthProvider, so
// its chunk is only requested after AuthProvider mounts). Children (AppRouter)
// render only after ALL providers are mounted, so useAuth()/useOrg()/useApp()
// are always available.
// ═══════════════════════════════════════════════════════════════════════════════

import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { AppProvider } from '@/contexts/AppContext';
import { OfflineBanner } from '@/components/shared/OfflineBanner';

// ── Heavy context providers lazy-loaded so Firebase stays OUT of the initial
//    `/` compile. Each becomes its own webpack chunk.
const AuthProvider = dynamic(
  () => import('@/contexts/AuthContext').then((m) => ({ default: m.AuthProvider })),
  {
    ssr: false,
    loading: () => <ProviderLoader label="Secure auth" />,
  },
);
const OrgProvider = dynamic(
  () => import('@/contexts/OrgContext').then((m) => ({ default: m.OrgProvider })),
  {
    ssr: false,
    loading: () => <ProviderLoader label="Workspace" />,
  },
);

// ── Heavy components lazy-loaded so they stay OUT of the initial `/` compile ──
// NOTE: OracleLauncher (the blue floating button) was REMOVED per the
// Oracle UX Restructure. Oracle is now reachable ONLY from the left
// navigation. There is no floating Oracle button anywhere in the app.
const DevServerReconnect = dynamic(
  () => import('@/components/shared/DevServerReconnect').then((m) => ({ default: m.DevServerReconnect })),
  { ssr: false, loading: () => null },
);
const ReactQueryDevtools = dynamic(
  () => import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })),
  { ssr: false, loading: () => null },
);

// ── Provider loader splash — shown while Firebase chunks compile ──
function ProviderLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl glass-surface motion-pulse">
          <Zap className="h-5 w-5 accent-text" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-medium text-foreground">Loading GSTPilot…</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </div>
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            // Retry ONLY transient errors (network, 5xx, 429). 4xx errors
            // (400/401/403/404) are deterministic and must NOT be retried —
            // retrying them wastes a round-trip and can lock accounts out
            // (e.g. too many 401s → auth/too-many-requests).
            retry: (failureCount, error) => {
              // Custom predicate — never retry 4xx.
              const status =
                (error as { status?: number })?.status ??
                (error as { response?: { status?: number } })?.response?.status;
              if (typeof status === 'number' && status >= 400 && status < 500) {
                return false;
              }
              return failureCount < 2;
            },
            // Keep showing stale data while refetching (prevents flicker on
            // page navigation).
            placeholderData: (prev: unknown) => prev,
          },
          mutations: {
            // Retry mutations once on transient errors only.
            retry: (failureCount, error) => {
              const status =
                (error as { status?: number })?.status ??
                (error as { response?: { status?: number } })?.response?.status;
              if (typeof status === 'number' && status >= 400 && status < 500) {
                return false;
              }
              return failureCount < 1;
            },
            // Auto-toast mutation errors that the caller doesn't handle.
            onError: (error, _variables, _context) => {
              const status =
                (error as { status?: number })?.status ??
                (error as { response?: { status?: number } })?.response?.status;
              // 401 → session-expired (AuthContext handles re-login).
              if (status === 401) {
                try {
                  window.dispatchEvent(new CustomEvent('gstpilot:session-expired'));
                } catch {
                  // ignore
                }
                return;
              }
              // Don't double-toast if the mutation already has an onError
              // handler that called toast — we only fire as a safety net for
              // mutations WITHOUT their own onError.
              const message =
                (error as Error)?.message &&
                !/firebase|firestore|prisma/i.test((error as Error).message)
                  ? (error as Error).message.slice(0, 140)
                  : 'Something went wrong. Please try again.';
              toast.error(message);
            },
          },
        },
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <OrgProvider>
            <AppProvider>
              {children}
              <Toaster />
              <OfflineBanner />
              {/* Preview stability: shows a professional reconnect overlay when
                  the dev server briefly restarts, instead of a browser error. */}
              <DevServerReconnect />
            </AppProvider>
          </OrgProvider>
        </AuthProvider>
        {/* ReactQueryDevtools hidden — dev-only floating button that marred the
            premium UI. Re-enable by adding ?rqd=1 to the URL. */}
        {typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('rqd') && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
