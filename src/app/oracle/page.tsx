'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GSTPilot Oracle™ — Full-Page Chat Experience
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This is the dedicated /oracle route — a full-page, professional AI chat
 * experience like ChatGPT / Claude / Gemini.
 *
 * Features:
 *   • Sidebar with New Chat, Recent Chats, Search, History
 *   • Streaming responses with SSE
 *   • Markdown rendering, code blocks, tables
 *   • File upload, voice input
 *   • Thinking indicator, auto-scroll
 *   • Copy response, regenerate, stop generation
 *   • Suggested prompts
 *
 * This page wraps itself with the same Providers as the main app so the
 * AuthContext, OrgContext, and AppContext are available to OracleWorkspace.
 */

import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Providers } from '@/components/providers';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import type { AppView } from '@/contexts/AppContext';
import { Zap } from 'lucide-react';

// ── Full-page loader ──────────────────────────────────────────────────────────
function OraclePageLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 motion-pulse">
          <Zap className="h-6 w-6 text-emerald-400" />
        </div>
        <span className="text-sm text-white/55 font-medium">Opening Oracle…</span>
      </div>
    </div>
  );
}

// ── Lazy-load the heavy OracleWorkspace (1730 lines) ─────────────────────────
const OracleWorkspace = dynamic(
  () => import('@/components/oracle/OracleWorkspace').then((m) => ({ default: m.OracleWorkspace })),
  { loading: OraclePageLoader, ssr: false },
);

// ── Inner component that uses the contexts (must be inside Providers) ─────────
function OraclePageInner() {
  const router = useRouter();
  const { user, isAuthenticated, isInitializing } = useAuth();
  const { organization } = useOrg();

  // The workspace is always "open" on this page — it's a full-page experience.
  const [open] = useState(true);

  const handleClose = useCallback(() => {
    // Go back to the dashboard
    router.push('/');
  }, [router]);

  const handleNavigate = useCallback((view: AppView) => {
    // Navigate back to the dashboard and set the view
    router.push(`/?view=${view}`);
  }, [router]);

  // ── Loading state while auth initializes ──
  if (isInitializing && !isAuthenticated) {
    return <OraclePageLoader />;
  }

  return (
    <OracleWorkspace
      open={open}
      onClose={handleClose}
      onNavigate={handleNavigate}
      userName={user?.name}
      firmName={organization?.name}
      gstin={organization?.gstin ?? undefined}
      userId={user?.id}
    />
  );
}

export default function OraclePage() {
  // Wrap with the same Providers as the main app so AuthContext, OrgContext,
  // and AppContext are available to OracleWorkspace.
  return (
    <Providers>
      <OraclePageInner />
    </Providers>
  );
}
