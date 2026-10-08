'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI — Empty State (ChatGPT-Enterprise redesign)
//
// Centered "How can I help with your business today?" headline (text-display)
// + 4 suggestion cards in a 2x2 grid. Deep dark bg (#0A0A0A), #111111 cards,
// #1F1F1F borders, gold/amber accent. 150ms opacity fade on mount.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import {
  Target, FileText, AlertTriangle, Wallet, type LucideIcon,
} from 'lucide-react';
import { InfinitySymbol } from '@/components/layout/InfinityMark';

interface OracleEmptyStateProps {
  onPick: (prompt: string) => void;
  userName?: string;
}

interface Suggestion {
  icon: LucideIcon;
  label: string;
  prompt: string;
  hint: string;
}

const SUGGESTIONS: Suggestion[] = [
  {
    icon: Target,
    label: 'Priorities',
    prompt: 'What should I prioritize today?',
    hint: 'Today\'s highest-impact actions',
  },
  {
    icon: FileText,
    label: 'Returns',
    prompt: 'Show overdue returns',
    hint: 'GSTR filings past their due date',
  },
  {
    icon: AlertTriangle,
    label: 'Risk',
    prompt: 'Which clients are at risk?',
    hint: 'Receivables, churn signals, blockers',
  },
  {
    icon: Wallet,
    label: 'Cash flow',
    prompt: 'Cash flow summary',
    hint: 'Bank balance, burn, 30-day forecast',
  },
];

export function OracleEmptyState({ onPick, userName }: OracleEmptyStateProps) {
  const firstName = userName?.split(' ')[0];
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12 text-center">
      {/* Avatar / orb — gold/amber gradient with subtle glow */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-[0_0_22px_-4px_rgba(245,158,11,0.55)] ring-1 ring-amber-500/30"
      >
        <InfinitySymbol size={26} />
      </motion.div>

      {/* Headline — text-display (var(--font-display) is set in globals.css) */}
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15, ease: 'easeOut', delay: 0.04 }}
        className="text-[28px] font-semibold leading-tight tracking-tight text-white sm:text-[32px]"
        style={{ fontFamily: 'var(--font-display, var(--font-sora, inherit))' }}
      >
        {firstName ? `How can I help, ${firstName}?` : 'How can I help with your business today?'}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15, ease: 'easeOut', delay: 0.08 }}
        className="mt-3 max-w-md text-[13px] leading-relaxed text-white/50"
      >
        Ask anything about GST, cash flow, compliance, or strategy. Oracle thinks
        like your CFO and answers from your real business data.
      </motion.p>

      {/* 2x2 suggestion grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15, ease: 'easeOut', delay: 0.12 }}
        className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {SUGGESTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.prompt}
              type="button"
              onClick={() => onPick(s.prompt)}
              className="group flex items-start gap-3 rounded-xl border border-[#1F1F1F] bg-[#111111] p-4 text-left transition-colors hover:border-[#2A2A2A] hover:bg-[#161616]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 transition-colors group-hover:bg-amber-500/15">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {s.label}
                </span>
                <p className="mt-1 text-[14px] font-medium leading-snug text-white">
                  {s.prompt}
                </p>
                <p className="mt-1 text-[11px] text-white/45">{s.hint}</p>
              </div>
            </button>
          );
        })}
      </motion.div>

      {/* Capability strip — minimal, amber dots */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15, ease: 'easeOut', delay: 0.16 }}
        className="mt-9 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-white/40"
      >
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-amber-500" /> Grounded in your data
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-amber-500" /> Remembers context
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-amber-500" /> Speaks 10 languages
        </span>
      </motion.div>
    </div>
  );
}

export default OracleEmptyState;
