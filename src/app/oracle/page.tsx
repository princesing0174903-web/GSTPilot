'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle — Dedicated Full-Screen Workspace (/oracle)
// ═══════════════════════════════════════════════════════════════════════════════
// The Oracle Workspace — a full-page ChatGPT-Enterprise-style AI CFO chat
// experience, isolated from the rest of the app.
//
//   • Opened ONLY when the user clicks "Oracle" in the left navigation.
//   • Two-column layout: conversation thread (max-width 768px, centered) +
//     Executive Brief insights sidebar (collapsible, hidden on mobile).
//   • Conversations persist to localStorage via the `useOracleConversations`
//     Zustand store; the streaming API is `/api/oracle/chat` (SSE).
//   • Closing Oracle returns the user to the dashboard.
//
// NOTE: This route does NOT wrap in <Providers> because OracleChat is
// self-contained — it reads the (optional) session user from localStorage
// for header display only; the chat API is single-tenant (userEmail optional).
// ═══════════════════════════════════════════════════════════════════════════════

import dynamic from 'next/dynamic';

// Lazy-load the Oracle Chat component (DB-persisted, streaming, structured).
const OracleChat = dynamic(
  () => import('@/components/oracle/OracleChat').then((m) => m.OracleChat),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-[0_0_28px_-4px_rgba(245,158,11,0.6)] ring-1 ring-amber-500/30 motion-pulse">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4L12 3z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M19 14l.8 2 2 .8-2 .8L19 20l-.8-1.6-2-.8 2-.8L19 14z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-base font-semibold text-white tracking-tight">
              Oracle
            </span>
            <span className="text-xs text-white/45 font-medium">Waking up the brain…</span>
          </div>
        </div>
      </div>
    ),
  },
);

export default function OraclePage() {
  // `page-rhythm` applies the staggered premium fade-in defined in globals.css
  // (premium-fade-in keyframe with nth-child delays up to 6 children).
  return (
    <div className="page-rhythm min-h-screen bg-[#0A0A0A]">
      <OracleChat />
    </div>
  );
}
