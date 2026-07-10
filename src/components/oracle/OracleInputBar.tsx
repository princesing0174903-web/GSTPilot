'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Premium Input Bar (Phase 2 — Human Intelligence™)
//
// Glass surface · 24px rounded corners · soft shadow · accent glow on focus.
// Inline buttons: 📎 Attach · 🎤 Voice (push-to-talk) · 🌐 Web Search · ➤ Send
//
// Phase 2 additions:
//   • Voice mode toggle (AudioLines icon) — opens the full-screen voice overlay
//   • Multilingual placeholder that rotates through supported languages
//
// Auto-resizing textarea (1 line → 6 lines). Enter to send, Shift+Enter for
// newline. Disabled state while Oracle is responding.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, AudioLines, Globe, Mic, Paperclip, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

// Rotating multilingual placeholders — reinforces "Oracle speaks every language".
const ROTATING_PLACEHOLDERS = [
  'Ask Oracle anything — GST, cash flow, compliance, strategy…',
  'GST return kaise file karu?',
  'Meri cash flow problem hai…',
  'How do I calculate ITC?',
  'What is overdue right now?',
  'Reconcile 2B vs books',
];

export interface OracleInputBarProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  /** When true, the send button becomes a "stop" button. */
  isStreaming?: boolean;
  onStop?: () => void;
  placeholder?: string;
  /** Phase 2 — open the full-screen voice conversation overlay. */
  onOpenVoice?: () => void;
}

export function OracleInputBar({
  onSubmit,
  disabled = false,
  isStreaming = false,
  onStop,
  placeholder,
  onOpenVoice,
}: OracleInputBarProps) {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [phIdx, setPhIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Rotate the placeholder every 4.5s when the bar is not focused and empty.
  useEffect(() => {
    if (isFocused || value.length > 0) return;
    const id = setInterval(() => {
      setPhIdx((i) => (i + 1) % ROTATING_PLACEHOLDERS.length);
    }, 4500);
    return () => clearInterval(id);
  }, [isFocused, value.length]);

  // Auto-resize: 1 line min, 6 lines max.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, 6 * 24 + 16);
    el.style.height = `${newHeight}px`;
  }, [value]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const currentPlaceholder = placeholder ?? ROTATING_PLACEHOLDERS[phIdx];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <motion.div
        layout
        className={cn(
          'search-glow group relative flex items-end gap-1.5 rounded-3xl border bg-card/60 p-2 backdrop-blur-2xl transition-all',
          isFocused
            ? 'border-[color-mix(in_srgb,var(--accent-start)_40%,transparent)] shadow-[0_8px_40px_-8px_rgba(0,229,255,0.18)]'
            : 'border-border shadow-[0_4px_24px_-8px_rgba(0,0,0,0.18)]',
          disabled && 'opacity-60',
        )}
      >
        {/* Attach button */}
        <IconButton label="Attach file">
          <Paperclip className="h-4 w-4" />
        </IconButton>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          rows={1}
          placeholder={currentPlaceholder}
          aria-label="Ask Oracle"
          className="flex-1 resize-none border-0 bg-transparent px-2 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed custom-scrollbar"
        />

        {/* Phase 2 — Voice mode toggle (opens full-screen voice overlay) */}
        {onOpenVoice && (
          <IconButton label="Voice mode" onClick={onOpenVoice}>
            <AudioLines className="h-4 w-4" />
          </IconButton>
        )}

        {/* Voice button (legacy push-to-talk indicator) */}
        <IconButton label="Voice input">
          <Mic className="h-4 w-4" />
        </IconButton>

        {/* Web search button */}
        <IconButton label="Web search" active>
          <Globe className="h-4 w-4" />
        </IconButton>

        {/* Send / Stop button */}
        {isStreaming ? (
          <motion.button
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onStop}
            aria-label="Stop generating"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/90 text-white shadow-lg shadow-red-500/30 transition-colors hover:bg-red-500"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSubmit}
            disabled={!value.trim() || disabled}
            aria-label="Send message"
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-2xl transition-all',
              value.trim() && !disabled
                ? 'accent-gradient text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40'
                : 'bg-card/[0.4] text-muted-foreground',
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </motion.button>
        )}
      </motion.div>

      {/* Helper text */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/70">
        <span>
          <kbd className="rounded bg-card/[0.06] px-1 py-0.5 font-mono text-[9px]">Enter</kbd> send
        </span>
        <span>·</span>
        <span>
          <kbd className="rounded bg-card/[0.06] px-1 py-0.5 font-mono text-[9px]">Shift+Enter</kbd> newline
        </span>
        <span>·</span>
        <span>Oracle speaks 12 languages · remembers everything</span>
      </div>
    </div>
  );
}

// ─── Icon Button (inline) ────────────────────────────────────────────────────

function IconButton({
  children,
  label,
  active = false,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-muted-foreground transition-all hover:bg-card/[0.5] hover:text-foreground',
        active && 'accent-text bg-card/[0.4]',
      )}
    >
      {children}
    </button>
  );
}

export default OracleInputBar;
