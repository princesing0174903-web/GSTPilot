'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Oracle Preview App (lightweight, Firebase-free entry)
// ═══════════════════════════════════════════════════════════════════════════════
// Renders Oracle AI directly with a local demo workspace. This module does
// NOT import AuthContext / OrgContext / @/lib/firebase, so Turbopack's
// dependency graph stays tiny and the 4 GB dev sandbox doesn't OOM during
// compile.
//
// The full app (AppRoot → AppRouter → DashboardShell) remains intact and is
// used in production. This preview entry is only used by src/app/page.tsx so
// the sandbox can render Oracle without compiling the 150-view dashboard +
// Firebase graph.
// ═══════════════════════════════════════════════════════════════════════════════

import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { OracleBrainCore } from '@/components/oracle/OracleBrainCore';
import { Zap } from 'lucide-react';

// Stable demo org ID — matches the local workspace that holds the Zoho-synced
// business data (customers, invoices, payments). Using a stable ID means
// Oracle always reads the same dataset across sessions.
const DEMO_ORG_ID = 'local-dXKkLqbkIjbwN41dEG4pI6PgiMl2';

export function OraclePreviewApp() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
          {/* Minimal top bar */}
          <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-white/[0.06] bg-background/60 backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600">
                <Zap className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-foreground">
                GSTPilot <span className="accent-text">Oracle™</span>
              </span>
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Preview
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live data · Local workspace
            </div>
          </header>

          {/* Oracle AI fills the rest */}
          <div className="flex-1 min-h-0">
            <OracleBrainCore orgId={DEMO_ORG_ID} isPreviewMode={true} />
          </div>
        </div>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default OraclePreviewApp;
