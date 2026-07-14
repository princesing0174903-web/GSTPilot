'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Root Providers
//
// Provider hierarchy (outer → inner):
//   ThemeProvider          — light/dark theming
//   QueryClientProvider    — TanStack Query (server state)
//   AuthProvider           — Firebase Auth identity (PART 1, 7, 8)
//   OrgProvider            — Current org + members + role (PART 3, 4)
//   AppProvider            — View routing / UI state
//
// OrgProvider MUST sit inside AuthProvider (it reads `useAuth()` to know when
// the user is authenticated) and outside AppProvider (so views can read org
// state).
// ═══════════════════════════════════════════════════════════════════════════════

import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { AppProvider } from '@/contexts/AppContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { OrgProvider } from '@/contexts/OrgContext';

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

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <OrgProvider>
            <AppProvider>
              {children}
              <Toaster />
              {/* Preview stability: shows a professional reconnect overlay when
                  the dev server briefly restarts, instead of a browser error. */}
              <DevServerReconnect />
            </AppProvider>
          </OrgProvider>
        </AuthProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
