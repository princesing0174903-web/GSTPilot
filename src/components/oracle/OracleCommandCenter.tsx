'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Obsidian Infinity™ Hero Command Box
//
// Home page hero. Calm, premium, Apple + Perplexity quality.
//   • Large pill, height 64px
//   • Placeholder: "Ask GSTPilot Oracle..."
//   • Includes: Attach files · Voice · Send button · 4 suggested chips
//   • Chips: File GST Return · Generate Report · Predict Revenue · Recover Collections
//
// On Enter or submit → opens the full Oracle Workspace (Perplexity-style 3-col).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Paperclip, Mic, Command } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOracleStore } from '@/lib/oracle-store';
import { InfinitySymbol } from '@/components/layout/InfinityMark';

const SUGGESTION_CHIPS = [
  'File GST Return',
  'Generate Report',
  'Predict Revenue',
  'Recover Collections',
];

interface OracleCommandCenterProps {
  /** Compact mode: smaller height for tight spaces (default false = 64px hero) */
  compact?: boolean;
  className?: string;
}

export function OracleCommandCenter({
  compact = false,
  className,
}: OracleCommandCenterProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const openWorkspace = useOracleStore((s) => s.openWorkspace);

  // ── Auto-grow textarea (single line by default, grows to 3 lines max) ──
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, compact ? 40 : 64)}px`;
  }, [query, compact]);

  // ── Submit handler ──
  const handleSubmit = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    openWorkspace(trimmed);
    setQuery('');
  }, [query, openWorkspace]);

  // ── Enter to submit (Shift+Enter for newline) ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  // ── Listen for "gstpilot-ask" custom events (from home empty-state buttons) ──
  // ⌘K is intentionally NOT handled here — it opens the universal Command Palette
  // (Linear-style) mounted at the page level.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string | undefined;
      if (detail) {
        setQuery(detail);
      }
      inputRef.current?.focus();
    };
    window.addEventListener('gstpilot-ask', handler);
    return () => window.removeEventListener('gstpilot-ask', handler);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className={cn('w-full max-w-[900px]', className)}
    >
      {/* ── The command box ── */}
      <div
        className={cn(
          'oracle-hero-glow group relative flex items-center gap-2.5 rounded-[28px] border bg-white/[0.05] backdrop-blur-[32px] saturate-[160%] transition-all sm:gap-3',
          compact ? 'px-4 py-3' : 'px-4 py-3.5 sm:px-5',
        )}
        style={{
          borderColor: 'rgba(255,255,255,0.08)',
          boxShadow: '0 0 50px rgba(0,245,212,0.10), 0 8px 32px -8px rgba(0,0,0,0.4)',
          minHeight: compact ? 52 : 64,
        }}
      >
        {/* Left: Infinity mark glow */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center">
          <div className="accent-gradient-soft flex h-9 w-9 items-center justify-center rounded-xl">
            <InfinitySymbol size={20} />
          </div>
        </div>

        {/* Center: Input */}
        <textarea
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Ask GSTPilot Oracle..."
          aria-label="Ask GSTPilot Oracle"
          className={cn(
            'min-w-0 flex-1 resize-none border-0 bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-0',
            compact ? 'text-sm' : 'text-base',
          )}
          style={{ fontWeight: 400, lineHeight: 1.5 }}
        />

        {/* Right: Attach · Voice · ⌘K hint · Send */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Attach files */}
          <button
            type="button"
            aria-label="Attach files"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
          >
            <Paperclip className="h-[18px] w-[18px]" />
          </button>
          {/* Voice */}
          <button
            type="button"
            aria-label="Voice input"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
          >
            <Mic className="h-[18px] w-[18px]" />
          </button>
          <kbd className="hidden items-center gap-0.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-1 text-[10px] font-semibold text-muted-foreground md:flex">
            <Command className="h-2.5 w-2.5" />
            <span>K</span>
          </kbd>
          {/* Send */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!query.trim()}
            aria-label="Submit to Oracle"
            className={cn(
              'flex items-center justify-center rounded-xl transition-all duration-200',
              query.trim()
                ? 'accent-gradient h-9 w-9 text-black hover:scale-105 hover:shadow-lg hover:shadow-[0_0_24px_rgba(0,245,212,0.4)]'
                : 'h-9 w-9 bg-white/[0.04] text-muted-foreground/40',
            )}
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Suggested prompts ── */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {SUGGESTION_CHIPS.map((chip, i) => (
          <motion.button
            key={chip}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 + i * 0.05 }}
            onClick={() => openWorkspace(chip)}
            className={cn(
              'group flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-muted-foreground',
              'transition-all duration-200 hover:border-[rgba(0,245,212,0.25)] hover:bg-white/[0.06] hover:text-foreground',
            )}
          >
            <span className="h-1 w-1 rounded-full bg-[#00F5D4] opacity-60 transition-opacity group-hover:opacity-100" />
            {chip}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

export default OracleCommandCenter;
