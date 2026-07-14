'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Root Page
// ═══════════════════════════════════════════════════════════════════════════════
// Oracle is the AI CFO of the company. It answers ONLY from real business data.
// This page mounts the full-screen Oracle Chat experience directly (no auth gate,
// no dashboard) — Oracle IS the product.
// ═══════════════════════════════════════════════════════════════════════════════

import dynamic from 'next/dynamic';

const OracleChat = dynamic(() => import('@/components/oracle-chat/OracleChat').then((m) => m.OracleChat), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 ring-1 ring-emerald-400/30 motion-pulse">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-4 4 4 4 0 0 0 4 4v1a4 4 0 0 0 8 0v-1a4 4 0 0 0 4-4 4 4 0 0 0-4-4V6a4 4 0 0 0-4-4Z" strokeLinecap="round" strokeLinejoin="round"/>
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
});

export default function Home() {
  return <OracleChat />;
}
