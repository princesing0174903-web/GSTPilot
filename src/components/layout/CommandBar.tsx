'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ V15 — Command Bar
// Always visible. Bottom center. Large search input. "Ask GSTPilot Oracle…"
// Enter → dispatches 'gstpilot-ask' event (the Oracle orb opens + asks).
// Ctrl/Cmd+K → opens the full-screen Oracle command palette (handled by orb).
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CommandBar() {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus shortcut: "/" focuses the command bar (common in premium apps)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept if user is already typing in an input/textarea
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
    window.dispatchEvent(new CustomEvent('gstpilot-ask', { detail: trimmed }));
    setValue('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(value);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className={cn(
          'glass-surface-strong pointer-events-auto flex w-full max-w-2xl items-center gap-2 rounded-3xl px-2 py-2 shadow-2xl shadow-black/40',
          'transition-all duration-300 focus-within:accent-ring'
        )}
      >
        {/* Oracle icon */}
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl accent-gradient shadow-lg shadow-emerald-500/20">
          <Sparkles className="h-4 w-4 text-white" />
        </span>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask GSTPilot Oracle…"
          aria-label="Ask GSTPilot Oracle"
          className={cn(
            'min-w-0 flex-1 bg-transparent px-1 text-sm font-medium text-foreground',
            'placeholder:text-muted-foreground/70 outline-none'
          )}
        />

        {/* Submit button */}
        <button
          type="submit"
          disabled={!value.trim()}
          aria-label="Submit question"
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition-all',
            value.trim()
              ? 'accent-gradient text-white shadow-lg shadow-emerald-500/30'
              : 'bg-white/[0.05] text-muted-foreground/40'
          )}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </motion.form>
    </div>
  );
}

export default CommandBar;
