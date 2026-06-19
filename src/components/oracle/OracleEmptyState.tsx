'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Premium Empty State
// Shown when a conversation has no messages yet. Replaces "No data" with
// warm, institutional copy + multilingual starter suggestions.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import {
  Sparkles, ShieldCheck, TrendingUp, Receipt, Calendar, Brain,
  type LucideIcon,
} from 'lucide-react';
import { ORACLE_SUGGESTIONS } from './oracle-human';
import { InfinitySymbol } from '@/components/layout/InfinityMark';

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  shield: ShieldCheck,
  trending: TrendingUp,
  receipt: Receipt,
  calendar: Calendar,
  brain: Brain,
};

interface OracleEmptyStateProps {
  onPick: (prompt: string) => void;
  userName?: string;
}

export function OracleEmptyState({ onPick, userName }: OracleEmptyStateProps) {
  const firstName = userName?.split(' ')[0];
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-10 text-center">
      {/* Avatar / orb */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative mb-5"
      >
        <div className="accent-gradient flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg shadow-emerald-500/20">
          <InfinitySymbol size={34} />
        </div>
        {/* breathing ring */}
        <span className="absolute inset-0 -z-10 rounded-2xl bg-emerald-500/20 blur-xl motion-pulse" />
      </motion.div>

      {/* Headline */}
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="text-xl font-semibold tracking-tight text-zinc-100"
      >
        {firstName ? `Welcome back, ${firstName}.` : 'Your Financial Brain is ready.'}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground"
      >
        Connect your business data and Oracle will start learning your business —
        remembering every conversation, speaking your language, and thinking like your CFO.
      </motion.p>

      {/* Suggestion grid */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.18 }}
        className="mt-7 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2"
      >
        {ORACLE_SUGGESTIONS.map((s, i) => {
          const Icon = ICONS[s.icon] ?? Sparkles;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(s.prompt)}
              className="group flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-left transition-all hover:border-white/[0.12] hover:bg-white/[0.05] hover-lift"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 transition-colors group-hover:bg-emerald-500/15">
                <Icon className="h-4 w-4 accent-text" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium leading-snug text-zinc-200">
                  {s.prompt}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{s.hint}</p>
              </div>
            </button>
          );
        })}
      </motion.div>

      {/* Capability strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground"
      >
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-emerald-400" /> 10 languages
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-cyan-400" /> GST law & CBIC
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-blue-400" /> Remembers everything
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-emerald-400" /> Thinks like your CFO
        </span>
      </motion.div>

      {/* Brand footer */}
      <p className="mt-8 text-[11px] text-muted-foreground/70">
        GSTPilot Oracle<span className="align-super text-[8px]">™</span> · The Financial Brain of India
        <br />
        <span className="text-muted-foreground/50">
          Founded &amp; developed by Prince Singh
        </span>
      </p>
    </div>
  );
}

export default OracleEmptyState;
