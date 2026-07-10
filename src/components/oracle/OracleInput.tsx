'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Input Box
//
// Signature Oracle input: large rounded capsule (24px radius), idle breathing
// glow that intensifies on focus. Attachment + voice + send icons. Auto-resizing
// textarea. Enter to send, Shift+Enter for newline.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  type KeyboardEvent,
} from 'react';
import { Paperclip, Mic, ArrowUp, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OracleInputHandle {
  focus: () => void;
  setValue: (v: string) => void;
}

interface OracleInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export const OracleInput = forwardRef<OracleInputHandle, OracleInputProps>(
  function OracleInput(
    {
      onSend,
      onStop,
      isStreaming = false,
      placeholder = 'Ask Oracle anything about GST, finance, or compliance…',
      className,
      autoFocus = true,
    },
    ref
  ) {
    const [value, setValue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // ── Auto-resize the textarea up to a max height ──
    useEffect(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
    }, [value]);

    // ── Focus on mount (if autoFocus) ──
    useEffect(() => {
      if (autoFocus) {
        textareaRef.current?.focus();
      }
    }, [autoFocus]);

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      setValue: (v: string) => {
        setValue(v);
        // Defer focus to next tick so the value is set
        requestAnimationFrame(() => textareaRef.current?.focus());
      },
    }));

    const send = () => {
      const trimmed = value.trim();
      if (!trimmed || isStreaming) return;
      onSend(trimmed);
      setValue('');
      // Reset height after send
      requestAnimationFrame(() => {
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      });
    };

    const stop = () => {
      onStop?.();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter to send (without shift)
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        if (isStreaming) return;
        send();
      }
    };

    const canSend = value.trim().length > 0 && !isStreaming;

    return (
      <div
        className={cn(
          'oracle-input-glow oracle-input-idle relative flex items-end gap-2 rounded-3xl border border-white/[0.08] bg-[#0a0a0e]/80 p-2.5 backdrop-blur-xl',
          className
        )}
      >
        {/* Attachment button */}
        <button
          type="button"
          onClick={() => {
            // Attachments not yet supported — visual only
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
          aria-label="Attach file"
          title="Attach file (coming soon)"
        >
          <Paperclip className="h-4 w-4" />
        </button>

        {/* The textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={placeholder}
          disabled={isStreaming}
          className={cn(
            'max-h-[200px] min-h-[24px] flex-1 resize-none border-0 bg-transparent py-1.5 text-[0.95rem] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-0 disabled:opacity-60',
            'scrollbar-thin'
          )}
          style={{ scrollbarWidth: 'thin' }}
          aria-label="Message Oracle"
        />

        {/* Voice button (visual) */}
        <button
          type="button"
          onClick={() => {
            // Voice input not yet supported — visual only
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
          aria-label="Voice input"
          title="Voice input (coming soon)"
        >
          <Mic className="h-4 w-4" />
        </button>

        {/* Send / Stop button */}
        {isStreaming ? (
          <button
            type="button"
            onClick={stop}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-foreground transition-all hover:bg-white/[0.14]"
            aria-label="Stop streaming"
            title="Stop"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all',
              canSend
                ? 'accent-gradient text-[#050505] hover:scale-105 hover:shadow-[0_0_20px_-2px_rgba(0,245,212,0.5)]'
                : 'cursor-not-allowed bg-white/[0.05] text-muted-foreground/50'
            )}
            aria-label="Send message"
            title="Send (Enter)"
          >
            <ArrowUp className="h-4.5 w-4.5" strokeWidth={2.5} />
          </button>
        )}
      </div>
    );
  }
);

export default OracleInput;
