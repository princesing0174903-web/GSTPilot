'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Root Page (Oracle Focus Mode)
//
// Today's session is dedicated to stabilizing Oracle AI. To keep the dev
// server within the 4 GB sandbox memory budget (the full AppRoot graph OOMs
// during Turbopack compile), this entry renders a lightweight landing that
// links directly to /oracle. The full AppRoot SPA remains intact at
// src/components/AppRoot.tsx and can be re-enabled by restoring the dynamic
// import once the OOM constraint is lifted.
// ═══════════════════════════════════════════════════════════════════════════════

import Link from 'next/link';
import { Sparkles, ArrowRight, Brain, ShieldCheck, Zap } from 'lucide-react';

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#070707] px-6 text-white">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/10 blur-[120px]"
      />

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center text-center">
        {/* Logo */}
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_32px_-4px_rgba(245,158,11,0.5)]">
          <Sparkles className="h-7 w-7 text-white" />
        </div>

        <span className="mb-3 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-400">
          Oracle Focus Mode
        </span>

        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          GSTPilot Oracle
          <span className="block bg-gradient-to-r from-amber-300 via-amber-400 to-amber-600 bg-clip-text text-transparent">
            Your Financial Brain
          </span>
        </h1>

        <p className="mt-4 max-w-md text-balance text-sm leading-relaxed text-white/60">
          Production-grade AI CFO with streaming responses, conversation memory,
          and autonomous financial intelligence.
        </p>

        {/* Feature pills */}
        <div className="mt-8 grid w-full grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-[#1F1F1F] bg-[#0E0E0E] p-3">
            <Brain className="h-4 w-4 text-amber-400" />
            <span className="text-[10px] font-medium text-white/70">Streaming</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-[#1F1F1F] bg-[#0E0E0E] p-3">
            <ShieldCheck className="h-4 w-4 text-amber-400" />
            <span className="text-[10px] font-medium text-white/70">Reliable</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-[#1F1F1F] bg-[#0E0E0E] p-3">
            <Zap className="h-4 w-4 text-amber-400" />
            <span className="text-[10px] font-medium text-white/70">Fast</span>
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/oracle"
          className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(245,158,11,0.6)] transition-all hover:shadow-[0_12px_32px_-8px_rgba(245,158,11,0.8)] hover:brightness-110"
        >
          Launch Oracle
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>

        <p className="mt-6 text-[10px] text-white/30">
          Oracle AI stabilization session · Chat · Streaming · Memory
        </p>
      </div>
    </main>
  );
}
