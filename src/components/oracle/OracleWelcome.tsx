'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Welcome / Empty State
//
// Shown when the active conversation has no messages. Centered, premium,
// Perplexity/Claude-style. Four capability cards + six suggestion prompts.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import {
  Sparkles,
  Receipt,
  TrendingUp,
  ShieldCheck,
  Calculator,
  ArrowRight,
} from 'lucide-react';
import { InfinitySymbol } from '@/components/layout/InfinityMark';

interface OracleWelcomeProps {
  onPickSuggestion: (prompt: string) => void;
}

const CAPABILITIES = [
  {
    icon: Receipt,
    label: 'GST Expert',
    desc: 'GSTR-1/3B, ITC, e-invoicing, e-way bill, late fees',
    color: '#00F5D4',
  },
  {
    icon: TrendingUp,
    label: 'AI CFO',
    desc: 'Cash flow, P&L, ratios, forecasts, runway',
    color: '#06B6D4',
  },
  {
    icon: Calculator,
    label: 'Financial Analyst',
    desc: 'Trends, benchmarks, variance, KPIs',
    color: '#00B8FF',
  },
  {
    icon: ShieldCheck,
    label: 'Compliance Assistant',
    desc: 'ROC, TDS, income tax, due dates, notices',
    color: '#3B82F6',
  },
];

const SUGGESTIONS = [
  {
    title: 'GST late fee calculation',
    prompt: 'What is the late fee for filing GSTR-3B 10 days late for a regular taxpayer?',
  },
  {
    title: 'ITC eligibility rules',
    prompt: 'When can a business claim Input Tax Credit under GST, and what are the conditions?',
  },
  {
    title: 'GSTR-3B vs GSTR-1',
    prompt: 'What is the difference between GSTR-1 and GSTR-3B? Do I need to file both?',
  },
  {
    title: 'TDS return due dates',
    prompt: 'What are the due dates for filing TDS returns in India, and what are the penalties for delay?',
  },
  {
    title: 'Tax audit 44AB threshold',
    prompt: 'What is the Section 44AB tax audit threshold for FY 2024-25, and who is exempt?',
  },
  {
    title: 'Working capital ratio',
    prompt: 'How do I calculate the current ratio and quick ratio, and what is a healthy range for an Indian SME?',
  },
];

export function OracleWelcome({ onPickSuggestion }: OracleWelcomeProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-12">
      {/* ── Logo + wordmark ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        className="relative mb-7 flex flex-col items-center"
      >
        {/* Breathing halo */}
        <div
          className="oracle-welcome-halo absolute -inset-6 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(0,245,212,0.18) 0%, transparent 65%)',
            filter: 'blur(28px)',
          }}
          aria-hidden
        />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl glass-surface">
          <InfinitySymbol size={40} />
        </div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
        className="text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
      >
        GSTPilot <span className="accent-text">Oracle</span>
        <span className="ml-1 align-super text-xs font-medium text-muted-foreground">™</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.18, ease: [0.4, 0, 0.2, 1] }}
        className="mt-2.5 max-w-xl text-center text-sm text-muted-foreground sm:text-base"
      >
        Your AI Financial Brain — GST · CFO · Compliance · Analytics.
        <br className="hidden sm:block" />
        Ask anything. Run everything.
      </motion.p>

      {/* ── Capability cards ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="mt-10 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {CAPABILITIES.map((cap, i) => {
          const Icon = cap.icon;
          return (
            <div
              key={cap.label}
              className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.025] p-4 hover-lift"
              style={{ transitionDelay: `${i * 40}ms` }}
            >
              <div
                className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg"
                style={{
                  background: `${cap.color}14`,
                  border: `1px solid ${cap.color}33`,
                }}
              >
                <Icon className="h-4.5 w-4.5" style={{ color: cap.color }} />
              </div>
              <p className="text-sm font-medium text-foreground">{cap.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {cap.desc}
              </p>
            </div>
          );
        })}
      </motion.div>

      {/* ── Suggested prompts ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.38, ease: [0.4, 0, 0.2, 1] }}
        className="mt-8 w-full max-w-3xl"
      >
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-[#00F5D4]" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Try asking
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.title}
              onClick={() => onPickSuggestion(s.prompt)}
              className="oracle-chip group flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{s.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {s.prompt}
                </p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[#00F5D4]" />
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default OracleWelcome;
