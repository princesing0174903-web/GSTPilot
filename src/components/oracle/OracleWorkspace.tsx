'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Human Experience Workspace
// A full-screen overlay chat that feels like Claude + Perplexity + Apple Intelligence.
//
// UX contract (Ultra Response Engine):
//   • No fake "thinking/reading/analyzing" phases — only "Oracle is responding…"
//     with a pulsing cursor while tokens stream.
//   • Response container appears immediately and expands smoothly (no jumping).
//   • Sticky input bar — fixed, never resizes unexpectedly.
//   • Smart auto-scroll — only when the user is near the bottom; pause on scroll-up.
//   • Brand questions are short-circuited client-side (instant canonical answer).
// ═══════════════════════════════════════════════════════════════════════════════

import {
  useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, X, Square, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { InfinitySymbol } from '@/components/layout/InfinityMark';
import { cn } from '@/lib/utils';
import {
  detectLanguage, detectEmotion, deriveAvatarState, AVATAR_STATE_LABEL,
  ORACLE_EMOTIONS, nativeLanguageLabel,
} from './oracle-human';
import { detectBrandQuestion } from './oracle-brand';
import { OracleEmptyState } from './OracleEmptyState';
import type { OracleMessage, OracleChatRequest, OracleStreamChunk } from './oracle-types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface OracleWorkspaceProps {
  open: boolean;
  onClose: () => void;
  userName?: string;
  firmName?: string;
  gstin?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'gstpilot-oracle-conversation-v1';

// ─── Component ────────────────────────────────────────────────────────────────

export function OracleWorkspace({
  open, onClose, userName, firmName, gstin,
}: OracleWorkspaceProps) {
  const [messages, setMessages] = useState<OracleMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastEmotion, setLastEmotion] = useState<OracleMessage['emotion']>('helpful');
  const [activeLanguage, setActiveLanguage] = useState<OracleMessage['language']>('english');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // True while the user is intentionally scrolled up — pauses auto-scroll.
  const userPinnedUpRef = useRef(false);
  const streamingIdRef = useRef<string | null>(null);

  // ─── Persist + restore conversation ────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as OracleMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Mark any previously-streaming message as complete on restore.
          setMessages(parsed.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
        }
      }
    } catch {
      /* ignore */
    }
  }, [open]);

  useEffect(() => {
    if (messages.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      /* ignore */
    }
  }, [messages]);

  // ─── Body scroll lock while open ───────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ─── Escape to close ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !isStreaming) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isStreaming, onClose]);

  // ─── Smart auto-scroll ─────────────────────────────────────────────────────
  // Auto-scroll to bottom only when the user is near the bottom. If they scroll
  // up, we pause auto-scroll until they return to the bottom.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userPinnedUpRef.current = distanceFromBottom > 120;
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // After every messages update, auto-scroll if the user is near the bottom.
  useEffect(() => {
    if (!userPinnedUpRef.current) {
      // Use rAF so layout settles before scrolling (prevents jump).
      requestAnimationFrame(() => scrollToBottom(false));
    }
  }, [messages, scrollToBottom]);

  // ─── Send flow ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || isStreaming) return;

      // ── Brand-question short-circuit (instant, canonical, no API) ──────────
      const brand = detectBrandQuestion(text);
      if (brand.matched && brand.answer) {
        const userMsg: OracleMessage = {
          id: cryptoId(),
          role: 'user',
          content: text,
          language: detectLanguage(text),
          createdAt: new Date().toISOString(),
        };
        const oracleMsg: OracleMessage = {
          id: cryptoId(),
          role: 'oracle',
          content: brand.answer,
          language: detectLanguage(text),
          emotion: 'success',
          createdAt: new Date().toISOString(),
          streaming: false,
          followUps: ['Who founded GSTPilot?', 'What can Oracle do?', 'GST kya hota hai?'],
        };
        setMessages((prev) => [...prev, userMsg, oracleMsg]);
        setLastEmotion('success');
        setActiveLanguage(detectLanguage(text));
        setInput('');
        if (inputRef.current) inputRef.current.style.height = 'auto';
        userPinnedUpRef.current = false;
        requestAnimationFrame(() => scrollToBottom(true));
        return;
      }

      const userMsg: OracleMessage = {
        id: cryptoId(),
        role: 'user',
        content: text,
        language: detectLanguage(text),
        createdAt: new Date().toISOString(),
      };
      const oracleId = cryptoId();
      const oraclePlaceholder: OracleMessage = {
        id: oracleId,
        role: 'oracle',
        content: '',
        language: userMsg.language,
        createdAt: new Date().toISOString(),
        streaming: true,
      };
      setMessages((prev) => [...prev, userMsg, oraclePlaceholder]);
      streamingIdRef.current = oracleId;
      setIsStreaming(true);
      setActiveLanguage(userMsg.language);
      setInput('');
      userPinnedUpRef.current = false;
      // Reset textarea height.
      if (inputRef.current) inputRef.current.style.height = 'auto';

      // ── Build the request payload from the full conversation ───────────────
      const history: OracleChatRequest['messages'] = [
        ...messages
          .filter((m) => m.content.trim().length > 0)
          .map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: text },
      ];

      const payload: OracleChatRequest = {
        messages: history,
        memory: {
          userName,
          firmName,
          gstin,
          preferredLanguage: activeLanguage,
          recentTopics: messages
            .filter((m) => m.role === 'user')
            .slice(-4)
            .map((m) => m.content.slice(0, 60)),
        },
      };

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/oracle/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let acc = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (!data || data === '[DONE]') continue;
            let chunk: OracleStreamChunk;
            try {
              chunk = JSON.parse(data) as OracleStreamChunk;
            } catch {
              continue;
            }
            if (chunk.language) setActiveLanguage(chunk.language);
            if (chunk.token) {
              acc += chunk.token;
              // Update the streaming message in place.
              setMessages((prev) =>
                prev.map((m) => (m.id === oracleId ? { ...m, content: acc } : m)),
              );
            }
            if (chunk.done) {
              // Finalize.
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === oracleId
                    ? {
                        ...m,
                        content: acc,
                        streaming: false,
                        emotion: detectEmotion(acc),
                        followUps: buildFollowUps(acc),
                      }
                    : m,
                ),
              );
              setLastEmotion(detectEmotion(acc));
            }
            if (chunk.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === oracleId
                    ? {
                        ...m,
                        content:
                          acc ||
                          "I ran into a temporary issue reaching my reasoning service. Please try that again — your conversation is safe.",
                        streaming: false,
                        emotion: 'warning',
                      }
                    : m,
                ),
              );
              setLastEmotion('warning');
            }
          }
        }

        // If the stream ended without an explicit done marker, finalize anyway.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === oracleId && m.streaming
              ? {
                  ...m,
                  streaming: false,
                  emotion: detectEmotion(m.content),
                  followUps: buildFollowUps(m.content),
                }
              : m,
          ),
        );
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === 'AbortError';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === oracleId
              ? {
                  ...m,
                  streaming: false,
                  content:
                    m.content ||
                    (aborted
                      ? 'Stopped.'
                      : "I had trouble reaching my reasoning service. Please try again in a moment."),
                  emotion: aborted ? m.emotion : 'warning',
                }
              : m,
          ),
        );
        if (!aborted) setLastEmotion('warning');
      } finally {
        setIsStreaming(false);
        streamingIdRef.current = null;
        abortRef.current = null;
        // Refocus input for rapid follow-up.
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [isStreaming, messages, userName, firmName, gstin, activeLanguage],
  );

  // ─── Stop streaming ────────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ─── Clear conversation ────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    if (isStreaming) return;
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [isStreaming]);

  // ─── Input handling ────────────────────────────────────────────────────────
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-grow textarea up to a max height.
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input);
      }
    },
    [input, sendMessage],
  );

  // ─── Focus input on open ───────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // ─── Avatar state ──────────────────────────────────────────────────────────
  const avatarState = useMemo(
    () => deriveAvatarState({ isStreaming, hasInput: input.trim().length > 0, lastEmotion }),
    [isStreaming, input, lastEmotion],
  );

  const isEmpty = messages.length === 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-background/80 backdrop-blur-xl"
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.99 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex h-full w-full max-w-3xl flex-col"
          >
            {/* ═══ HEADER ═══ */}
            <header className="flex shrink-0 items-center gap-3 px-5 py-3.5">
              <OracleAvatar state={avatarState} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-0.5">
                  <span className="text-sm font-semibold text-zinc-100">GSTPilot Oracle</span>
                  <sup className="text-[9px] font-medium text-muted-foreground">™</sup>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span
                    className={cn(
                      'inline-flex h-1.5 w-1.5 rounded-full',
                      isStreaming ? 'bg-amber-400' : 'bg-emerald-400',
                    )}
                  />
                  <span>{isStreaming ? 'Responding' : AVATAR_STATE_LABEL[avatarState]}</span>
                  {activeLanguage && activeLanguage !== 'english' && (
                    <span className="text-muted-foreground/50">· {nativeLanguageLabel(activeLanguage)}</span>
                  )}
                </div>
              </div>

              {messages.length > 0 && !isStreaming && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                disabled={isStreaming}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground disabled:opacity-40"
                aria-label="Close Oracle"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="mx-5 h-px bg-white/[0.06]" />

            {/* ═══ MESSAGES ═══ */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5"
            >
              {isEmpty ? (
                <OracleEmptyState onPick={(p) => sendMessage(p)} userName={userName} />
              ) : (
                <div className="mx-auto flex max-w-2xl flex-col gap-5 py-6">
                  {messages.map((m) => (
                    <MessageBubble key={m.id} message={m} onPickFollowUp={sendMessage} />
                  ))}
                </div>
              )}
            </div>

            {/* ═══ STICKY INPUT ═══ */}
            <div className="shrink-0 px-5 pb-5 pt-2">
              <div className="mx-auto max-w-2xl">
                <div className="relative flex items-end gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2 transition-colors focus-within:border-white/[0.16] focus-within:bg-white/[0.05]">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder="Ask Oracle anything — GST, returns, cash flow, ITC…"
                    className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent px-2.5 py-1.5 text-sm leading-relaxed text-zinc-100 placeholder:text-muted-foreground/70 focus:outline-none custom-scrollbar"
                    disabled={isStreaming}
                  />
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={handleStop}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-zinc-300 transition-colors hover:bg-white/[0.12]"
                      aria-label="Stop"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => sendMessage(input)}
                      disabled={!input.trim()}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl accent-gradient text-white shadow-lg shadow-emerald-500/20 transition-all hover:opacity-90 disabled:opacity-30 disabled:shadow-none"
                      aria-label="Send"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-muted-foreground/60">
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Oracle replies in your language · Enter to send · Shift+Enter for newline
                  </span>
                  <span className="hidden sm:inline">
                    GSTPilot Oracle™ · Founded by Prince Singh
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Oracle Avatar (dynamic state) ────────────────────────────────────────────

function OracleAvatar({ state }: { state: ReturnType<typeof deriveAvatarState> }) {
  const ringColor =
    state === 'speaking'
      ? 'bg-amber-400'
      : state === 'warning'
        ? 'bg-rose-400'
        : state === 'success'
          ? 'bg-emerald-400'
          : 'bg-emerald-400';
  return (
    <div className="relative">
      <div className="accent-gradient flex h-9 w-9 items-center justify-center rounded-xl shadow-lg shadow-emerald-500/20">
        <InfinitySymbol size={20} />
      </div>
      <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
        {state === 'speaking' && (
          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', ringColor)} />
        )}
        <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-background', ringColor)} />
      </span>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onPickFollowUp,
}: {
  message: OracleMessage;
  onPickFollowUp: (prompt: string) => void;
}) {
  const isUser = message.role === 'user';
  const emotionGlyph = !isUser && message.emotion ? ORACLE_EMOTIONS[message.emotion]?.glyph : null;

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-white/[0.06] px-4 py-2.5 text-sm leading-relaxed text-zinc-100">
          {message.content}
        </div>
      </motion.div>
    );
  }

  const isEmptyStreaming = message.streaming && !message.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex gap-3"
    >
      {/* Avatar */}
      <div className="mt-0.5 shrink-0">
        <div className="accent-gradient flex h-7 w-7 items-center justify-center rounded-lg shadow-md shadow-emerald-500/15">
          <InfinitySymbol size={15} />
        </div>
      </div>

      {/* Bubble */}
      <div className="min-w-0 flex-1">
        {emotionGlyph && (
          <div className="mb-1 text-xs" aria-hidden>
            {emotionGlyph}
          </div>
        )}

        {isEmptyStreaming ? (
          <RespondingIndicator />
        ) : (
          <div className="oracle-prose text-sm leading-relaxed text-zinc-200">
            <ReactMarkdown
              components={{
                // Open links in a new tab safely.
                a: ({ children, href }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="accent-text underline underline-offset-2">
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
            {message.streaming && <PulsingCursor />}
          </div>
        )}

        {/* Follow-up chips */}
        {message.followUps && message.followUps.length > 0 && !message.streaming && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.followUps.map((f, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onPickFollowUp(f)}
                className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-all hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-foreground"
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── "Oracle is responding…" with pulsing cursor ─────────────────────────────

function RespondingIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="animate-pulse">Oracle is responding</span>
      </span>
      <span className="text-muted-foreground/50">…</span>
    </div>
  );
}

function PulsingCursor() {
  return (
    <span
      className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse rounded-full bg-emerald-400 align-middle"
      aria-hidden
    />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cryptoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Generate contextual follow-up chips from the response content. */
function buildFollowUps(content: string): string[] | undefined {
  if (!content || content.length < 30) return undefined;
  const lower = content.toLowerCase();

  const pool: string[] = [];
  if (/(gstr-3b|3b)/.test(lower)) pool.push('GSTR-3B की last date क्या है?', 'Late fee कितनी लगेगी?');
  if (/(gstr-1|gstr 1)/.test(lower)) pool.push('GSTR-1 कैसे file करें?', 'B2B और B2C में अंतर?');
  if (/(itc|input tax credit)/.test(lower)) pool.push('ITC claim कैसे करें?', 'Blocked ITC के rules?');
  if (/(late fee|penalty|overdue)/.test(lower)) pool.push('Late fee waiver मिल सकती है?', 'How to avoid this next time?');
  if (/(cash flow|collections)/.test(lower)) pool.push('Receivables कैसे recover करें?', 'Working capital optimize करें');
  if (/(reverse charge|rcm)/.test(lower)) pool.push('RCM किन पर लागू है?', 'How to report RCM in GSTR-3B?');
  if (/(refund)/.test(lower)) pool.push('Refund process क्या है?', 'Refund timeline कितनी है?');

  // Generic, always-safe follow-ups.
  pool.push('GST kya hota hai?', 'Explain ITC rules', 'How can Oracle help me daily?');

  // De-duplicate and pick 3.
  const seen = new Set<string>();
  const picks: string[] = [];
  for (const p of pool) {
    if (seen.has(p)) continue;
    seen.add(p);
    picks.push(p);
    if (picks.length >= 3) break;
  }
  return picks;
}

export default OracleWorkspace;
