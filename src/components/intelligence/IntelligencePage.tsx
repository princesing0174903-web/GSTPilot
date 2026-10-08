'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Intelligence™ — "The AI CFO" landing page (Obsidian Infinity™)
//
// A calm, premium, Perplexity-for-business entry point:
//   1. Header — "Your AI Chief Financial Officer."
//   2. Hero ask box — large glowing pill, opens the full Oracle workspace.
//   3. Example questions — tappable card chips that open the workspace.
//   4. What Oracle can do — 3 calm capability cards.
//   5. Empty-state reassurance — "Oracle is always learning…"
//
// On submit (Enter or Send button) → useOracleStore.openWorkspace(question).
// The full Perplexity-style 3-column Oracle Workspace takes over the screen.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Brain, Database, Sparkles, Zap } from 'lucide-react';
import { InfinitySymbol } from '@/components/layout/InfinityMark';
import { useOracleStore } from '@/lib/oracle-store';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAMPLE_QUESTIONS = [
  'How much money will I need next month?',
  'Why is revenue decreasing?',
  "Who hasn't paid?",
  "Predict next month's cash flow",
  'Which clients are risky?',
] as const;

const CAPABILITIES = [
  {
    icon: Database,
    title: 'Reads your data',
    description: 'Invoices, returns, bank, GST — all in context.',
  },
  {
    icon: Brain,
    title: 'Thinks like a CFO',
    description: 'Analyzes, predicts, and recommends actions.',
  },
  {
    icon: Zap,
    title: 'Acts on your behalf',
    description: 'Send reminders, file returns, generate reports.',
  },
] as const;

// Shared easing — calm, premium, no bounce.
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

// ─── Component ────────────────────────────────────────────────────────────────

export function IntelligencePage() {
  const openWorkspace = useOracleStore((s) => s.openWorkspace);
  const [query, setQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the ask textarea (single line by default, grows up to ~5 lines).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [query]);

  // Submit → open the full Oracle workspace with the trimmed question.
  const handleSubmit = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    openWorkspace(trimmed);
    setQuery('');
  }, [query, openWorkspace]);

  // Enter to submit, Shift+Enter for newline.
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Example chip → open the workspace directly with the canned question.
  const handleExample = useCallback(
    (q: string) => {
      openWorkspace(q);
    },
    [openWorkspace],
  );

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-10 px-4 py-8 md:py-12">
      {/* ── 1. Header ─────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="flex flex-col items-center text-center"
      >
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
          <Brain className="h-3.5 w-3.5 text-[#00F5D4]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Intelligence
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[32px]">
          Your AI Chief Financial Officer.
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground md:text-[15px]">
          Ask anything about your business. Oracle reads your data and answers like a CFO.
        </p>
      </motion.header>

      {/* ── 2. The Ask Box — the hero ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: EASE }}
        className="w-full"
      >
        <div
          className={cn(
            'oracle-hero-glow flex min-h-[64px] items-center gap-3 rounded-[28px]',
            'border border-white/[0.08] bg-white/[0.05] px-3',
            'shadow-[0_0_50px_rgba(0,245,212,0.10)]',
          )}
        >
          {/* Left — Infinity Mark in a soft accent box */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl accent-gradient-soft">
            <InfinitySymbol size={20} />
          </div>

          {/* Center — auto-growing ask textarea */}
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ask your Financial Brain anything…"
            aria-label="Ask your Financial Brain anything"
            className={cn(
              'max-h-[140px] flex-1 resize-none border-0 bg-transparent py-3',
              'text-[15px] font-medium leading-6 text-foreground',
              'placeholder:font-normal placeholder:text-muted-foreground/70',
              'outline-none focus:ring-0 custom-scrollbar',
            )}
          />

          {/* Right — Send button (disabled when empty) */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!query.trim()}
            aria-label="Ask VEYRO AI"
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
              'accent-gradient text-white',
              'transition-all duration-200 ease-out',
              'hover:scale-[1.04] active:scale-95',
              'disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100',
            )}
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </motion.div>

      {/* ── 3. Example questions ──────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
        className="flex flex-col gap-3"
        aria-label="Example questions"
      >
        <div className="flex items-center gap-2 px-1">
          <Sparkles className="h-3.5 w-3.5 text-[#00F5D4]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Try asking
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {EXAMPLE_QUESTIONS.map((q, i) => (
            <motion.button
              key={q}
              type="button"
              onClick={() => handleExample(q)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 + i * 0.05, ease: EASE }}
              className={cn(
                'glass-surface hover-lift group flex items-center gap-3 rounded-[20px] p-4 text-left',
                'hover:border-[#00F5D4]/25',
                // Span the full row on the last (5th) chip to balance the 2-col grid.
                i === EXAMPLE_QUESTIONS.length - 1 && 'sm:col-span-2',
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                <span className="h-2 w-2 rounded-full bg-[#00F5D4] shadow-[0_0_8px_rgba(0,245,212,0.6)]" />
              </span>
              <span className="flex-1 text-sm font-medium text-foreground/90 md:text-[15px]">
                {q}
              </span>
              <ArrowUpRight
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground',
                  'transition-all duration-200 ease-out',
                  'group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#00F5D4]',
                )}
              />
            </motion.button>
          ))}
        </div>
      </motion.section>

      {/* ── 4. What Oracle can do ─────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: EASE }}
        className="grid grid-cols-1 gap-3 md:grid-cols-3"
        aria-label="What Oracle can do"
      >
        {CAPABILITIES.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.title}
              className="glass-surface flex flex-col gap-3 rounded-[20px] p-5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl accent-gradient-soft">
                <Icon className="h-5 w-5 text-[#00F5D4]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{c.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {c.description}
                </p>
              </div>
            </div>
          );
        })}
      </motion.section>

      {/* ── 5. Empty-state reassurance ────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25, ease: EASE }}
        className="flex flex-col items-center gap-2 pt-2 text-center"
      >
        <InfinitySymbol size={16} />
        <p className="text-xs leading-relaxed text-muted-foreground/80">
          Oracle is always learning. The more data you connect, the smarter it gets.
        </p>
      </motion.div>
    </div>
  );
}

export default IntelligencePage;
