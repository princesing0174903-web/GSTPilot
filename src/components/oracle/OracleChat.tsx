'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle — Full-Screen AI CFO Experience (Task 8 redesign)
//
// ChatGPT Enterprise + Claude + Harvey AI level:
//   • Full-screen welcome with "Oracle AI CFO / Your Financial Brain"
//   • Thinking animation with checklist before streaming
//   • Rich answer cards (Executive Summary, Cash Flow chart, GST Risk)
//   • Oracle Actions (buttons instead of typing)
//   • HTTP 400 errors silently retried — NEVER shown to user
//
// Layout:
//   • No messages → Full-screen OracleWelcomeScreen (hero + suggestion cards)
//   • Has messages → Chat thread (max-w-3xl centered) with rich bubbles
//   • Sticky premium input at bottom (gold gradient, action icons)
//
// Streaming: POST /api/oracle/chat returns SSE.
//   {token} → append token | {done:true} → finalize | {error} → retry/fallback
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, Bell, LogOut, User as UserIcon, Brain, Plug, Share2,
  Plus, MessageSquare, Trash2, X, Sparkles, BadgeCheck,
} from 'lucide-react';
import {
  Avatar, AvatarFallback, AvatarImage,
} from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOracleConversations } from '@/lib/oracle-conversations';
import { OracleInput, type OracleInputHandle } from './OracleInput';
import { OracleWelcomeScreen } from './OracleWelcomeScreen';
import { OracleThinkingAnimation } from './OracleThinkingAnimation';
import { OracleActions } from './OracleActions';

// Lazy-load heavy panels to keep initial compile light (prevents OOM on 4GB machines)
const OracleMessage = dynamic(() => import('./OracleMessage').then((m) => m.OracleMessage), { ssr: false });
const MemoryPanel = dynamic(() => import('./MemoryPanel').then((m) => m.MemoryPanel), { ssr: false });
const ConnectorsPanel = dynamic(() => import('./ConnectorsPanel').then((m) => m.ConnectorsPanel), { ssr: false });
const BusinessGraphPanel = dynamic(() => import('./BusinessGraphPanel').then((m) => m.BusinessGraphPanel), { ssr: false });

// ─── Session reader (standalone-safe, no Providers needed) ────────────────────

interface SessionUser {
  id?: string;
  name?: string;
  email?: string;
  picture?: string;
}

const SESSION_KEY = 'gstpilot_session';

function readSessionUser(): SessionUser {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        id: parsed.id,
        name: parsed.name,
        email: parsed.email,
        picture: parsed.picture,
      };
    }
  } catch { /* non-fatal */ }
  return {};
}

function useSessionUser(): SessionUser {
  const [user, setUser] = useState<SessionUser>(() => readSessionUser());
  useEffect(() => {
    const handler = () => setUser(readSessionUser());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);
  return user;
}

// ─── Stream event type ────────────────────────────────────────────────────────

interface StreamEvent {
  token?: string;
  done?: boolean;
  error?: string;
  structured?: unknown;
  language?: string;
}

// ─── streamOracle — with automatic HTTP 400/500 retry ─────────────────────────
//
// CRITICAL: The user must NEVER see "messages[] is required" (HTTP 400).
// On 400/500 errors, we retry up to 3 times with exponential backoff
// (1s → 2s → 4s). If all retries fail, we show a friendly fallback message
// instead of the raw error.

const MAX_RETRIES = 3;
const FRIENDLY_ERROR = "I'm having trouble connecting right now. Please try again in a moment.";

async function fetchWithRetry(
  payload: unknown,
  signal?: AbortSignal
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    try {
      const res = await fetch('/api/oracle/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });

      // 200 OK — return immediately
      if (res.ok) return res;

      // 400 / 500 errors — retry with backoff (unless aborted)
      const bodyText = await res.text().catch(() => '');
      lastError = new Error(`HTTP ${res.status}: ${bodyText}`);

      // Don't retry on 401/403 (auth errors) — those won't fix themselves
      if (res.status === 401 || res.status === 403) {
        throw new Error('Authentication required. Please sign in again.');
      }

      // Retry for 400/500 errors
      if (attempt < MAX_RETRIES - 1) {
        const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
    } catch (err) {
      // Network error or abort
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      lastError = err instanceof Error ? err : new Error('Network error');

      if (attempt < MAX_RETRIES - 1) {
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
    }
  }

  // All retries exhausted — throw friendly error
  throw new Error(FRIENDLY_ERROR);
}

async function streamOracle(
  payload: {
    message: string;
    history: { role: 'user' | 'assistant'; content: string }[];
    userEmail?: string;
    userName?: string;
    userId?: string;
  },
  handlers: {
    onDelta: (delta: string) => void;
    onFollowUps: (prompts: string[]) => void;
    onDone: () => void;
    onError: (message: string) => void;
    onRetry?: (attempt: number) => void;
  },
  signal?: AbortSignal
): Promise<void> {
  try {
    // Build the OracleChatRequest payload
    const messages = [
      ...payload.history.map((m) => ({
        role: (m.role === 'user' ? 'user' : 'oracle') as 'user' | 'oracle',
        content: m.content,
      })),
      { role: 'user' as const, content: payload.message },
    ];

    let organizationId: string | undefined;
    try {
      organizationId = window.localStorage.getItem('gstpilot_org_id') ?? undefined;
    } catch { /* private mode */ }

    const apiPayload = {
      messages,
      memory: { userName: payload.userName, userId: payload.userId },
      context: organizationId ? { organizationId } : undefined,
    };

    // Fetch with automatic retry on 400/500
    const res = await fetchWithRetry(apiPayload, signal);

    if (!res.body) {
      handlers.onDone();
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const evt of events) {
        const line = evt.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        const payloadStr = line.slice(5).trim();
        if (!payloadStr || payloadStr === '[DONE]') continue;

        try {
          const data = JSON.parse(payloadStr) as StreamEvent;
          if (data.token) handlers.onDelta(data.token);
          if (data.done) { handlers.onDone(); return; }
          if (data.error) { handlers.onError(FRIENDLY_ERROR); return; }
        } catch { /* skip malformed */ }
      }
    }
    handlers.onDone();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      handlers.onDone();
      return;
    }
    // NEVER expose raw HTTP 400 "messages[] required" — always friendly
    const msg = err instanceof Error ? err.message : 'Network error';
    handlers.onError(msg.includes('HTTP 4') ? FRIENDLY_ERROR : msg);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OracleChat() {
  const user = useSessionUser();
  const logout = () => {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* non-fatal */ }
    if (typeof window !== 'undefined') window.location.href = '/';
  };

  const conversations = useOracleConversations((s) => s.conversations);
  const activeId = useOracleConversations((s) => s.activeId);
  const getActive = useOracleConversations((s) => s.getActive);
  const createConversation = useOracleConversations((s) => s.createConversation);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [showThinking, setShowThinking] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<OracleInputHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const isStreamingRef = useRef(false);

  const activeRef = useRef<ReturnType<typeof getActive>>(null);
  const active = getActive();

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);

  const messages = active?.messages ?? [];
  const hasMessages = messages.length > 0;

  // Auto-scroll
  useEffect(() => {
    if (!scrollRef.current || !shouldAutoScrollRef.current) return;
    const el = scrollRef.current;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, showThinking]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    shouldAutoScrollRef.current = atBottom;
  };

  function buildHistoryPayload(excludeOracleTurnId: string) {
    const current = activeRef.current;
    if (!current) return [];
    return current.messages
      .filter((m) => m.id !== excludeOracleTurnId && !m.streaming && !m.error)
      .map((m) => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }));
  }

  // ── Send a message ──
  const handleSend = async (message: string) => {
    if (isStreamingRef.current) return;

    const store = useOracleConversations.getState();
    let convId = store.activeId;
    if (!convId) convId = store.createConversation();

    const { oracleTurnId } = store.pushUserMessage(message);
    store.ensureTitle(convId, message);
    const history = buildHistoryPayload(oracleTurnId);

    setIsStreaming(true);
    isStreamingRef.current = true;
    shouldAutoScrollRef.current = true;
    setShowThinking(true);

    const controller = new AbortController();
    abortRef.current = controller;

    // Show thinking animation for 1.8s before stream starts
    await new Promise((r) => setTimeout(r, 1800));
    if (controller.signal.aborted) return;
    setShowThinking(false);

    await streamOracle(
      { message, history, userEmail: user?.email, userName: user?.name, userId: user?.id },
      {
        onDelta: (delta) => store.appendDelta(oracleTurnId, delta),
        onFollowUps: (prompts) => store.setFollowUps(oracleTurnId, prompts),
        onDone: () => {
          store.finalizeMessage(oracleTurnId);
          setIsStreaming(false);
          isStreamingRef.current = false;
          setShowThinking(false);
          abortRef.current = null;
          requestAnimationFrame(() => inputRef.current?.focus());
        },
        onError: (errorMessage) => {
          store.setError(oracleTurnId, errorMessage);
          setIsStreaming(false);
          isStreamingRef.current = false;
          setShowThinking(false);
          abortRef.current = null;
          requestAnimationFrame(() => inputRef.current?.focus());
        },
      },
      controller.signal
    );
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    isStreamingRef.current = false;
    setShowThinking(false);
  };

  const handlePickSuggestion = (prompt: string) => {
    const store = useOracleConversations.getState();
    const current = store.getActive();
    if (current && current.messages.length > 0) store.createConversation();
    requestAnimationFrame(() => handleSend(prompt));
  };

  const handleRetry = () => {
    const current = activeRef.current;
    if (!current || isStreamingRef.current) return;
    const lastUser = [...current.messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    handleSend(lastUser.content);
  };

  const handleNewChat = () => {
    createConversation();
    setHistoryOpen(false);
  };

  const userInitials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'G';

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#070707] text-white">
      {/* ── Top bar ── */}
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-[#1F1F1F] bg-[#070707]/80 px-3 backdrop-blur-xl md:px-5">
        <button
          onClick={() => setHistoryOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
          aria-label="Conversation history"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_16px_-2px_rgba(245,158,11,0.4)]">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col items-start leading-none">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-semibold tracking-tight text-white">Oracle</span>
              <BadgeCheck className="h-3.5 w-3.5 text-amber-500" />
              <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-500">
                CA-Verified
              </span>
            </div>
            <span className="mt-0.5 text-[10px] font-medium text-white/45">Your AI CFO</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setGraphOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
            aria-label="Business Graph"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setConnectorsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
            aria-label="Data Connectors"
          >
            <Plug className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMemoryOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
            aria-label="Business Memory"
          >
            <Brain className="h-4 w-4" />
          </button>
          <button
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-1.5 py-1 outline-none transition-colors hover:bg-white/[0.05]">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.picture} alt={user?.name || 'User'} />
                <AvatarFallback className="bg-amber-500/15 text-[11px] font-semibold text-amber-500">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center gap-2 p-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.picture} alt={user?.name || 'User'} />
                  <AvatarFallback className="bg-amber-500/15 text-xs font-semibold text-amber-500">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name || 'Guest'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2">
                <UserIcon className="h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50">
                <LogOut className="h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="relative z-10 flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Scrollable area */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="min-h-0 flex-1 overflow-y-auto custom-scrollbar"
          >
            {hasMessages ? (
              <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
                <div className="space-y-6">
                  {messages.map((turn, idx) => (
                    <div key={turn.id}>
                      <OracleMessage
                        turn={turn}
                        onPickFollowUp={handlePickSuggestion}
                        onRetry={turn.role === 'oracle' && turn.id === messages[messages.length - 1]?.id ? handleRetry : undefined}
                      />
                      {/* Show Oracle Actions after the last Oracle message when not streaming */}
                      {turn.role === 'oracle' && !turn.streaming && !turn.error &&
                        idx === messages.length - 1 && !isStreaming && (
                        <OracleActions onAction={handlePickSuggestion} />
                      )}
                      {/* Thinking animation appears after the latest user message while streaming */}
                      {turn.role === 'user' && idx === messages.length - 1 && showThinking && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex gap-3 mt-6"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_12px_-2px_rgba(245,158,11,0.4)]">
                            <Sparkles className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1 rounded-3xl rounded-bl-md border border-[#1F1F1F] bg-[#111111] px-4 py-2">
                            <OracleThinkingAnimation />
                          </div>
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="h-8" />
              </div>
            ) : (
              <OracleWelcomeScreen userName={user?.name} onPick={handlePickSuggestion} />
            )}
          </div>

          {/* ── Sticky input ── */}
          <div className="shrink-0 bg-gradient-to-t from-[#070707] via-[#070707]/95 to-transparent px-4 pb-4 pt-3 sm:px-6">
            <div className="mx-auto w-full max-w-3xl">
              <OracleInput
                ref={inputRef}
                onSend={handleSend}
                onStop={handleStop}
                isStreaming={isStreaming}
              />
              <p className="mt-2 text-center text-[10.5px] text-white/35">
                Oracle is your AI CFO · Uses live data from your connected accounts · Always verify critical tax decisions
              </p>
            </div>
          </div>
        </main>
      </div>

      {/* ── History drawer ── */}
      <AnimatePresence>
        {historyOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40"
            onClick={() => setHistoryOpen(false)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-[#1F1F1F] bg-[#0A0A0A] p-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="text-sm font-semibold text-white">Conversations</span>
                <button
                  onClick={() => setHistoryOpen(false)}
                  className="rounded-lg p-1 text-white/50 hover:bg-white/5 hover:text-white"
                  aria-label="Close history"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={handleNewChat}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-2px_rgba(245,158,11,0.4)]"
              >
                <Plus className="h-4 w-4" />
                New Conversation
              </button>
              <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
                {conversations.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-white/40">No conversations yet</p>
                ) : (
                  conversations.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        useOracleConversations.getState().setActive(c.id);
                        setHistoryOpen(false);
                      }}
                      className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                        c.id === activeId
                          ? 'bg-white/[0.06] text-white ring-1 ring-inset ring-white/10'
                          : 'text-white/60 hover:bg-white/[0.03] hover:text-white'
                      }`}
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{c.title || 'New conversation'}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          useOracleConversations.getState().deleteConversation(c.id);
                        }}
                        className="ml-auto shrink-0 text-white/40 opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </button>
                  ))
                )}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Slide-in panels ── */}
      <MemoryPanel open={memoryOpen} onClose={() => setMemoryOpen(false)} userEmail={user?.email} />
      <ConnectorsPanel open={connectorsOpen} onClose={() => setConnectorsOpen(false)} />
      <BusinessGraphPanel
        open={graphOpen}
        onClose={() => setGraphOpen(false)}
        onOpenConnectors={() => { setGraphOpen(false); setConnectorsOpen(true); }}
      />
    </div>
  );
}

export default OracleChat;
