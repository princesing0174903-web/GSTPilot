'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Home / Control Center (Oracle Focus)
//
// Premium control center that positions Oracle as the centerpiece of the
// entire product. The hero is a massive Oracle card that opens the full-screen
// AI CFO experience. Below it: quick stats + secondary navigation.
//
// This page is intentionally lightweight (no heavy dashboard imports) so it
// compiles within the 4 GB sandbox memory budget and loads in <1s.
// ═══════════════════════════════════════════════════════════════════════════════

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Sparkles, ArrowRight, Brain, ShieldCheck, TrendingUp, Receipt,
  Users, Zap, BadgeCheck, Activity, Database, Landmark,
} from 'lucide-react';

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070707] text-white">
      {/* ── Ambient background glow ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-amber-500/[0.07] blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-amber-600/[0.05] blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-8">
        {/* ── Top nav ── */}
        <header className="mb-8 flex items-center justify-between sm:mb-12">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_20px_-4px_rgba(245,158,11,0.5)]">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[15px] font-bold tracking-tight text-white">GSTPilot</span>
              <span className="text-[10px] font-medium text-white/40">Financial Brain of India</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-[11px] font-medium text-emerald-400 sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              All systems operational
            </span>
            <a
              href="/oracle"
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-600 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_4px_14px_-2px_rgba(245,158,11,0.4)] transition-all hover:brightness-110"
            >
              Open Oracle
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </header>

        {/* ── Hero: Oracle Card ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 sm:mb-8"
        >
          <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-[#0F0B05] via-[#0A0807] to-[#070707] p-6 sm:p-10">
            {/* Glow accents */}
            <div aria-hidden className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
            <div aria-hidden className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-amber-600/5 blur-3xl" />

            <div className="relative z-10 flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
              {/* Left: copy */}
              <div className="max-w-2xl">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }}
                  className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_40px_-4px_rgba(245,158,11,0.5)] ring-1 ring-amber-500/30"
                >
                  <Brain className="h-7 w-7 text-white" />
                </motion.div>

                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                    AI CFO
                  </span>
                  <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[11px] font-medium text-emerald-400">
                    <BadgeCheck className="h-3 w-3" />
                    CA-Verified
                  </span>
                </div>

                <h1 className="mb-2 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Oracle AI CFO
                </h1>
                <p className="mb-6 text-lg font-medium text-amber-300/80 sm:text-xl">
                  Your Financial Brain
                </p>
                <p className="mb-8 max-w-lg text-sm leading-relaxed text-white/60 sm:text-base">
                  Production-grade AI Chief Financial Officer. Streaming answers,
                  live business context, GST expertise, and autonomous financial
                  intelligence — all in one brain.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/oracle"
                    className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(245,158,11,0.6)] transition-all hover:shadow-[0_12px_32px_-8px_rgba(245,158,11,0.8)] hover:brightness-110"
                  >
                    Launch Oracle
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <div className="flex items-center gap-1.5 text-[12px] text-white/40">
                    <Zap className="h-3.5 w-3.5 text-amber-400" />
                    Instant · No setup
                  </div>
                </div>
              </div>

              {/* Right: floating capability chips */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="hidden grid-cols-2 gap-3 lg:grid"
              >
                {[
                  { icon: TrendingUp, label: 'Cash Flow', desc: 'Forecast & runway', color: 'emerald' },
                  { icon: Receipt, label: 'GST Filing', desc: 'GSTR-1/3B/2B', color: 'cyan' },
                  { icon: ShieldCheck, label: 'Compliance', desc: 'ITC & TDS', color: 'amber' },
                  { icon: Users, label: 'Receivables', desc: 'Collections', color: 'violet' },
                ].map((cap, i) => {
                  const Icon = cap.icon;
                  return (
                    <motion.div
                      key={cap.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.08 }}
                      className="flex w-[160px] flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-sm transition-colors hover:border-amber-500/20 hover:bg-amber-500/[0.03]"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20">
                        <Icon className="h-4 w-4 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-white">{cap.label}</p>
                        <p className="text-[11px] text-white/50">{cap.desc}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* ── Quick stats strip ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:grid-cols-4"
        >
          {[
            { icon: Activity, label: 'Streaming', value: 'Real-time', sub: 'Token-by-token' },
            { icon: Database, label: 'Memory', value: 'Persistent', sub: 'Cross-session' },
            { icon: ShieldCheck, label: 'Reliability', value: '99.9%', sub: 'Auto-retry' },
            { icon: Zap, label: 'Speed', value: '<2s', sub: 'First token' },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-2xl border border-[#1F1F1F] bg-[#0E0E0E] p-4 transition-colors hover:border-[#2A2A2A]"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-amber-400" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-white/50">{stat.label}</span>
                </div>
                <p className="text-lg font-bold text-white">{stat.value}</p>
                <p className="text-[11px] text-white/40">{stat.sub}</p>
              </div>
            );
          })}
        </motion.section>

        {/* ── Secondary cards ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mb-8 grid gap-4 sm:grid-cols-3"
        >
          {[
            {
              icon: Receipt,
              title: 'GST Intelligence',
              desc: 'GSTR-1, 3B, 2B reconciliation. ITC matching. E-invoicing. Reverse charge.',
              href: '/oracle',
              cta: 'Ask Oracle',
            },
            {
              icon: Landmark,
              title: 'Banking & Cash',
              desc: 'Live bank feeds, auto-reconciliation, cash flow forecasting, runway.',
              href: '/oracle',
              cta: 'Ask Oracle',
            },
            {
              icon: Users,
              title: 'Customers & Vendors',
              desc: 'Receivables aging, collection priorities, vendor risk scoring.',
              href: '/oracle',
              cta: 'Ask Oracle',
            },
          ].map((card, i) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                href={card.href}
                className="group rounded-2xl border border-[#1F1F1F] bg-[#0E0E0E] p-5 transition-all hover:border-amber-500/20 hover:bg-[#111111]"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20 transition-colors group-hover:bg-amber-500/15">
                  <Icon className="h-5 w-5 text-amber-400" />
                </div>
                <h3 className="mb-1.5 text-[15px] font-semibold text-white">{card.title}</h3>
                <p className="mb-3 text-[12.5px] leading-relaxed text-white/55">{card.desc}</p>
                <span className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-400 transition-colors group-hover:text-amber-300">
                  {card.cta}
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </motion.section>

        {/* ── Footer ── */}
        <footer className="mt-auto pt-6">
          <div className="flex flex-col items-center justify-between gap-3 border-t border-[#1F1F1F] pt-6 sm:flex-row">
            <p className="text-[11px] text-white/40">
              GSTPilot Oracle™ · The Financial Brain of India
            </p>
            <div className="flex items-center gap-4 text-[11px] text-white/40">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                Bank-grade security
              </span>
              <span className="flex items-center gap-1">
                <BadgeCheck className="h-3 w-3 text-amber-400" />
                CA-verified
              </span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
