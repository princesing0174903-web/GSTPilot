'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI — Premium Input Bar (ChatGPT-Enterprise redesign)
//
// Rounded-2xl · #161616 bg · #2A2A2A border · blue focus ring · circular blue
// send button. Inline buttons: 📎 Attach · 🎤 Voice · 🌐 Web Search · ➤ Send
//
// Multilingual placeholder that rotates through supported languages. Auto-
// resizing textarea (1 line → 6 lines). Enter to send, Shift+Enter for
// newline. Disabled state while Oracle is responding.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, AudioLines, Globe, Mic, Paperclip, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

// Rotating multilingual placeholders — reinforces "Oracle speaks every language".
const ROTATING_PLACEHOLDERS = [
  'Ask VEYRO AI anything — GST, cash flow, compliance, strategy…',
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
  /** Open the full-screen voice conversation overlay. */
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
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={cn(
          'group relative flex items-end gap-1.5 rounded-2xl border bg-[#161616] p-2 transition-colors',
          isFocused
            ? 'border-[#2A2A2A] ring-2 ring-[#2563EB]/20 shadow-[0_0_0_3px_rgba(37,99,235,0.15)]'
            : 'border-[#2A2A2A] hover:border-[#3A3A3A]',
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
          disabled={disabled}
          rows={1}
          placeholder={currentPlaceholder}
          aria-label="Ask VEYRO AI"
          className="flex-1 resize-none border-0 bg-transparent px-2 py-2.5 text-[14px] text-white placeholder:text-white/40 focus:outline-none disabled:cursor-not-allowed custom-scrollbar"
          style={{ fontFamily: 'var(--font-body, inherit)' }}
        />

        {/* Voice mode toggle (opens full-screen voice overlay) */}
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

        {/* Send / Stop button — circular, blue */}
        {isStreaming ? (
          <motion.button
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onStop}
            aria-label="Stop generating"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.10] text-white transition-colors hover:bg-white/[0.16]"
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
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all',
              value.trim() && !disabled
                ? 'bg-[#2563EB] text-white hover:bg-[#1D4ED8] hover:shadow-[0_4px_14px_-2px_rgba(37,99,235,0.45)]'
                : 'cursor-not-allowed bg-white/[0.05] text-white/35',
            )}
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </motion.button>
        )}
      </motion.div>

      {/* Helper text */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-white/40">
        <span>
          <kbd className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[9px]">Enter</kbd> send
        </span>
        <span>·</span>
        <span>
          <kbd className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[9px]">Shift+Enter</kbd> newline
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
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/55 transition-all hover:bg-white/[0.06] hover:text-white',
        active && 'bg-emerald-500/10 text-emerald-400',
      )}
    >
      {children}
    </button>
  );
}

export default OracleInputBar;
