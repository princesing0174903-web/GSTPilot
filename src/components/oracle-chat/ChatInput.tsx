'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE CHAT — Premium Input
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Square, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const QUICK_PROMPTS = [
  'How much money am I expecting?',
  'Which customers need follow-up?',
  'What happened this week?',
  'How much GST will I pay?',
  'Should I hire more employees?',
  'Give me my cash position',
];

export function ChatInput({
  onSend,
  streaming,
  compact = false,
}: {
  onSend: (text: string) => void;
  streaming: boolean;
  compact?: boolean;
}) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || streaming) return;
    onSend(trimmed);
    setValue('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="space-y-2.5">
      {!compact && (
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => !streaming && onSend(p)}
              disabled={streaming}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12.5px] text-zinc-300 transition hover:border-emerald-400/30 hover:bg-emerald-400/[0.06] hover:text-emerald-200 disabled:opacity-40"
            >
              {p}
            </button>
          ))}
        </div>
      )}
      <div className="relative flex items-end gap-2 rounded-2xl border border-white/10 bg-black/40 p-2 shadow-lg shadow-black/20 backdrop-blur transition focus-within:border-emerald-400/40 focus-within:ring-2 focus-within:ring-emerald-400/20">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Ask Oracle anything about your business…"
          disabled={streaming}
          className="flex-1 resize-none bg-transparent px-3 py-2 text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={!value.trim() || streaming}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
            value.trim() && !streaming
              ? 'bg-gradient-to-br from-emerald-400 to-emerald-500 text-black hover:from-emerald-300 hover:to-emerald-400 shadow-lg shadow-emerald-500/20'
              : 'bg-white/5 text-zinc-500'
          }`}
        >
          {streaming ? <Square className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </div>
      {!compact && (
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
          <Sparkles className="h-3 w-3 text-emerald-400/60" />
          Oracle answers only from your real business data — never fabricated.
        </p>
      )}
    </div>
  );
}
