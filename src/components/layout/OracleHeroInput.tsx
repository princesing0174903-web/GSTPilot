'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — V17 Hero Search Input
//
// "VEYRO AI input becomes the hero of the dashboard."
// Placed directly below: Good Morning, Prince 👋
//
// Spec:
//   Height:    72px
//   Radius:    28px
//   Background: rgba(255,255,255,0.08)
//   Blur:      32px
//   Border:    rgba(255,255,255,0.12)
//   Padding:   24px
//   Shadow:    0 20px 60px rgba(0,0,0,0.4)
//
// Right side:  ⌘K  +  Arrow submit button
// Placeholder: "Ask VEYRO AI…"
// Subtitle:    "Run your business, ask questions, or execute actions instantly."
//
// Behavior: Perplexity / ChatGPT / Cursor-grade.
//   • Enter  → dispatch 'gstpilot-ask' (opens the full Oracle palette + asks)
//   • ⌘K     → open VEYRO AI palette directly (no question)
//   • Clicking a suggested prompt → fill + submit immediately
//   • "/" focuses when not already in an input
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InfinitySymbol } from '@/components/layout/InfinityMark';

const SUGGESTED_PROMPTS = [
  'Run my business',
  'Show pending returns',
  'Why did collections drop?',
  'Generate report',
  'Predict revenue',
];

export function OracleHeroInput() {
  const [value, setValue] = useState('');
  const [showChips, setShowChips] = useState(true);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K opens the full Oracle palette directly (no question)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        // Open palette with empty question — the VEYROIntelligence component
        // also listens for ⌘K, so this is a defensive double-trigger.
        window.dispatchEvent(new CustomEvent('gstpilot-ask', { detail: '' }));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const ask = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      // Empty submit → still open the palette so the user can browse
      inputRef.current?.blur();
      return;
    }
    window.dispatchEvent(new CustomEvent('gstpilot-ask', { detail: trimmed }));
    setValue('');
    setShowChips(true);
    inputRef.current?.blur();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(value);
  };

  const handleChipClick = (prompt: string) => {
    setValue(prompt);
    setShowChips(false);
    ask(prompt);
  };

  const hasText = value.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="w-full"
    >
      {/* Subtitle */}
      <p className="mb-3 text-center text-sm text-muted-foreground/80 md:text-base">
        Run your business, ask questions, or execute actions instantly.
      </p>

      {/* ── Hero input ── */}
      <form
        onSubmit={handleSubmit}
        className={cn(
          'oracle-hero-glow relative flex items-center gap-3 rounded-[28px] px-6',
          'border border-white/[0.12] bg-white/[0.08] backdrop-blur-[32px]',
          'shadow-[0_20px_60px_rgba(0,0,0,0.4)]',
          'transition-all duration-300',
        )}
        style={{ height: 72 }}
      >
        {/* InfinityMark on the left — the brand anchor */}
        <span className="flex shrink-0 items-center justify-center" aria-hidden>
          <InfinitySymbol size={30} />
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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Ask VEYRO AI…"
          aria-label="Ask VEYRO AI"
          className="min-w-0 flex-1 bg-transparent text-base font-medium text-foreground outline-none placeholder:text-muted-foreground/60 md:text-lg"
        />

        {/* Right cluster: ⌘K hint + Arrow submit */}
        <div className="flex shrink-0 items-center gap-2">
          <kbd
            className="hidden items-center gap-0.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-muted-foreground sm:flex"
            aria-hidden
          >
            <span>⌘</span>
            <span>K</span>
          </kbd>

          <button
            type="submit"
            disabled={!hasText}
            aria-label="Ask VEYRO AI"
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-200',
              hasText
                ? 'accent-gradient text-white shadow-lg shadow-blue-500/30 hover:scale-[1.04]'
                : 'bg-white/[0.05] text-muted-foreground/40',
            )}
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* Subtle Enter hint when focused + has text */}
        <AnimatePresence>
          {focused && hasText && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[11px] text-muted-foreground/70"
            >
              <CornerDownLeft className="h-3 w-3" />
              <span>Press Enter to ask</span>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* ── Suggested prompts ── */}
      <AnimatePresence mode="wait">
        {showChips && (
          <motion.div
            key="chips"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="mt-5 flex flex-wrap items-center justify-center gap-2"
          >
            {SUGGESTED_PROMPTS.map((prompt, i) => (
              <motion.button
                key={prompt}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.25 + i * 0.05 }}
                onClick={() => handleChipClick(prompt)}
                className="group flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-all duration-200 hover:border-blue-400/30 hover:bg-white/[0.06] hover:text-foreground hover-lift"
              >
                <span className="h-1 w-1 rounded-full bg-cyan-400/60 transition-colors group-hover:bg-blue-400" />
                {prompt}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default OracleHeroInput;
