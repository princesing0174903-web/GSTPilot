'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ V16 — Command Bar
// Perplexity / ChatGPT / Cursor-style search:
//   • glass-surface-strong + search-glow on focus
//   • InfinityMark symbol on the left, ArrowUp submit on the right
//   • Example prompt chips below — hide while typing, reappear when empty
//   • Enter → dispatches 'oracle-ask' (the VEYRO AI™ workspace opens + asks)
//   • "/" focuses the input (when not already typing in one)
//   • Clicking a chip fills the input + submits immediately
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InfinitySymbol } from '@/components/layout/InfinityMark';

const EXAMPLE_PROMPTS = [
  'Run my business',
  'Why did collections drop?',
  'Generate GST report',
  'Show risky clients',
  'Predict next month revenue',
];

export function CommandBar() {
  const [value, setValue] = useState('');
  const [showChips, setShowChips] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus shortcut: "/" focuses the command bar (when not already in an input)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const ask = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    // Route to the NEW full-screen VEYRO AI™ workspace (listened to by
    // OraclePanel). The legacy intelligence palette keeps its own launcher.
    window.dispatchEvent(new CustomEvent('oracle-ask', { detail: trimmed }));
    setValue('');
    setShowChips(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(value);
  };

  const handleChipClick = (prompt: string) => {
    // Fill the input (intent) then immediately submit + clear.
    setValue(prompt);
    setShowChips(false);
    ask(prompt);
  };

  const hasText = value.trim().length > 0;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="glass-surface-strong search-glow pointer-events-auto w-full max-w-2xl rounded-3xl px-3 py-2.5 shadow-2xl shadow-black/40"
      >
        {/* Main input row: InfinityMark · input · submit */}
        <div className="flex items-center gap-2">
          {/* InfinityMark symbol */}
          <span className="flex shrink-0 items-center justify-center" aria-hidden>
            <InfinitySymbol size={28} />
          </span>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => {
              const v = e.target.value;
              setValue(v);
              setShowChips(v.trim().length === 0);
            }}
            placeholder="Ask VEYRO AI…"
            aria-label="Ask VEYRO AI"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/70"
          />

          {/* Submit button */}
          <button
            type="submit"
            disabled={!hasText}
            aria-label="Submit question"
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition-all',
              hasText
                ? 'accent-gradient text-white shadow-lg shadow-blue-500/30'
                : 'bg-white/[0.05] text-muted-foreground/40'
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>

        {/* Example chips row — visible only when input is empty */}
        {showChips && (
          <div className="flex flex-wrap items-center gap-1.5 px-1 pt-2">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleChipClick(prompt)}
                className="hover-lift rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </motion.form>
    </div>
  );
}

export default CommandBar;
