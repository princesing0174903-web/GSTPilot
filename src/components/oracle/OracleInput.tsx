'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle — Input Box (Executive Command Center redesign)
//
// Premium capsule input with:
//   • Specific placeholder ("Ask about cash flow, GST filings, ITC, vendor fraud…")
//   • Amber gradient border on focus (2px, from-amber-500/40 → transparent)
//   • Action icons on the left: Paperclip (attach) · BarChart3 (chart) · RefreshCw (agent)
//   • Gold/amber gradient send button (was blue)
//   • Character count "123/2000" below the input (right-aligned, faint)
//   • Suggested prompt pills below the input (3 chips, horizontal scroll on mobile)
//
// Auto-resizing textarea (1 → 6 lines max). Enter to send, Shift+Enter for newline.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import {
  Paperclip,
  BarChart3,
  RefreshCw,
  Mic,
  ArrowUp,
  Square,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OracleInputHandle {
  focus: () => void;
  setValue: (v: string) => void;
}

interface OracleInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  /** Called when the user picks a file via the attach button. */
  onFileUpload?: (file: File) => void;
  /** True while a file is being uploaded — disables the attach button + shows a spinner. */
  isUploading?: boolean;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

const MAX_CHARS = 2000;

const SUGGESTED_PROMPTS = [
  'Analyze my Q2 GST filing',
  'Flag potential ITC issues',
  'Forecast my cash runway',
];

export const OracleInput = forwardRef<OracleInputHandle, OracleInputProps>(
  function OracleInput(
    {
      onSend,
      onStop,
      isStreaming = false,
      onFileUpload,
      isUploading = false,
      placeholder = 'Ask about cash flow, GST filings, ITC, vendor fraud…',
      className,
      autoFocus = true,
    },
    ref
  ) {
    const [value, setValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const handleFilePick = (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Always reset the input value so picking the same file twice fires again.
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (!file) return;
      // Reject obviously unsupported / oversized files client-side (max 8 MB,
      // matching the server cap).
      const MAX_BYTES = 8 * 1024 * 1024;
      if (file.size > MAX_BYTES) {
        return;
      }
      onFileUpload?.(file);
    };

    const openFilePicker = () => {
      if (isUploading || isStreaming) return;
      fileInputRef.current?.click();
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
    const charCount = value.length;

    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {/* ── Gradient focus border wrapper ──
            When focused, an amber gradient ring (1px) shows around the input
            capsule. The inner div sits on top with its own bg so the gradient
            appears as a subtle 1-2px border. */}
        <div
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={cn(
            'rounded-2xl p-px transition-all duration-200',
            isFocused
              ? 'bg-gradient-to-r from-amber-500/50 via-amber-500/10 to-transparent shadow-[0_0_24px_-6px_rgba(245,158,11,0.25)]'
              : 'bg-[#1F1F1F] hover:bg-[#2A2A2A]'
          )}
        >
          <div
            className={cn(
              'flex items-end gap-2 rounded-[15px] bg-[#161616] p-3 transition-colors'
            )}
          >
            {/* ── Action icons (left side, before textarea) ── */}
            <button
              type="button"
              onClick={openFilePicker}
              disabled={isUploading || isStreaming}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50 disabled:hover:bg-transparent"
              aria-label="Attach file"
              title="Attach a document (PDF, image, or text)"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.md,.doc,.docx,.xls,.xlsx"
              onChange={handleFilePick}
            />

            <button
              type="button"
              onClick={() => {
                // Future: trigger chart-rendering mode
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
              aria-label="Show me a chart"
              title="Show me a chart"
            >
              <BarChart3 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                // Future: open the agent picker
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
              aria-label="Run an agent"
              title="Run an agent"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            {/* The textarea */}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                // Enforce max length
                if (e.target.value.length <= MAX_CHARS) {
                  setValue(e.target.value);
                }
              }}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={placeholder}
              disabled={isStreaming}
              maxLength={MAX_CHARS}
              className={cn(
                'max-h-[200px] min-h-[24px] flex-1 resize-none border-0 bg-transparent py-1.5 text-[14px] leading-relaxed text-white placeholder:text-white/40 focus:outline-none focus:ring-0 disabled:opacity-60',
                'scrollbar-thin'
              )}
              style={{ scrollbarWidth: 'thin', fontFamily: 'var(--font-body, inherit)' }}
              aria-label="Message Oracle"
            />

            {/* Voice button (visual) */}
            <button
              type="button"
              onClick={() => {
                // Voice input not yet supported — visual only
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label="Voice input"
              title="Voice input (coming soon)"
            >
              <Mic className="h-4 w-4" />
            </button>

            {/* Send / Stop button — gold/amber gradient */}
            {isStreaming ? (
              <button
                type="button"
                onClick={stop}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.10] text-white transition-all hover:bg-white/[0.16]"
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
                    ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white hover:shadow-[0_4px_14px_-2px_rgba(245,158,11,0.5)] hover:brightness-110'
                    : 'cursor-not-allowed bg-white/[0.05] text-white/35'
                )}
                aria-label="Send message"
                title="Send (Enter)"
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>

        {/* ── Character count + suggested prompts row ── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            {/* Suggested prompts — horizontal scroll on mobile, wrap on desktop */}
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    if (isStreaming) return;
                    onSend(prompt);
                  }}
                  className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-white/60 transition-colors hover:border-amber-500/30 hover:bg-amber-500/[0.06] hover:text-amber-300"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Character count */}
            <span
              className={cn(
                'shrink-0 text-[10px] tabular-nums transition-colors',
                charCount > MAX_CHARS * 0.9
                  ? 'text-amber-400/80'
                  : 'text-white/30'
              )}
              aria-live="polite"
            >
              {charCount}/{MAX_CHARS}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

export default OracleInput;
