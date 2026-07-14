'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Dedicated Full-Screen Workspace (/oracle)
// ═══════════════════════════════════════════════════════════════════════════════
// This is the Oracle Workspace — a completely separate, full-page AI CFO chat
// experience, isolated from the rest of the app. Behaviour:
//
//   • Opened ONLY when the user clicks "Oracle" in the left navigation.
//   • The dashboard (/) NEVER auto-opens Oracle.
//   • Full-screen 3-column layout: Conversation Sidebar | Chat | Insights.
//   • Conversations are persisted to the real database (OracleAISession,
//     OracleAIMessage, OracleAIToolCall) — refreshing the page keeps history.
//   • Closing Oracle returns the user to the dashboard.
//
// NOTE: This route does NOT wrap in <Providers> because OracleChat is
// self-contained — it uses a Zustand store (useOracleChat) for state, not
// AuthContext/OrgContext/AppContext. The Oracle Chat API endpoints are
// single-tenant (userId: null) so no auth provider is required. This keeps
// the /oracle compile graph small and memory-light.
//
// The OracleLauncher floating button has been REMOVED from the global
// providers — Oracle is reachable ONLY from the left navigation.
// ═══════════════════════════════════════════════════════════════════════════════

import dynamic from 'next/dynamic';

// Lazy-load the Oracle Chat component (DB-persisted, streaming, structured).
const OracleChat = dynamic(
  () => import('@/components/oracle-chat/OracleChat').then((m) => m.OracleChat),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 ring-1 ring-emerald-400/30 motion-pulse">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-4 4 4 4 0 0 0 4 4v1a4 4 0 0 0 8 0v-1a4 4 0 0 0 4-4 4 4 0 0 0-4-4V6a4 4 0 0 0-4-4Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-base font-semibold text-white tracking-tight">
              Oracle<span className="text-emerald-400"> CFO</span>
            </span>
            <span className="text-xs text-white/45 font-medium">Waking up the financial brain…</span>
          </div>
        </div>
      </div>
    ),
  },
);

export default function OraclePage() {
  return <OracleChat />;
}
