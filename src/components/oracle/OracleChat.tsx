'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle — Main Chat Component (ChatGPT Enterprise redesign)
//
// Layout — two columns on desktop:
//   LEFT  (flex)  — conversation thread (max-width 768px, centered)
//   RIGHT (320px) — Insights sidebar (collapsible, hidden on mobile)
//
// Top bar (minimal):
//   "Oracle" wordmark · "Your AI business brain" subtitle · "GPT-4 class" badge
//   + history drawer trigger + insights toggle.
//
// Bottom (sticky):
//   Fixed input bar (max-width 768px, centered) — rounded-2xl, #161616 bg,
//   #2A2A2A border, blue focus ring, circular blue send button.
//
// Streaming: POST /api/oracle/chat returns SSE. Handlers unchanged from the
// previous implementation — only the visual layout was redesigned.
//   {type:'delta',content}      → append token to oracle message
//   {type:'followups',prompts}  → attach suggestions to oracle message
//   {type:'done'}               → finalize streaming
//   {type:'error',message}      → mark error
//
// Conversation history persists in localStorage via the
// `useOracleConversations` Zustand store (no Providers wrapper required).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, Bell, LogOut, User as UserIcon, Brain, Plug, Share2,
  PanelRightClose, PanelRight, Plus, MessageSquare, Trash2, X,
} from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOracleConversations } from '@/lib/oracle-conversations';
import { InfinitySymbol } from '@/components/layout/InfinityMark';
import { OracleEmptyState } from './OracleEmptyState';
import { OracleInput, type OracleInputHandle } from './OracleInput';
import { OracleMessage } from './OracleMessage';
import { MemoryPanel } from './MemoryPanel';
import { ConnectorsPanel } from './ConnectorsPanel';
import { BusinessGraphPanel } from './BusinessGraphPanel';

// ─── Standalone-safe session reader ───────────────────────────────────────────
// The /oracle route intentionally does NOT mount <Providers> (no AuthContext,
// no ThemeProvider). The chat API is single-tenant (userEmail optional), so
// the user object is purely decorative (header avatar + MemoryPanel email).
// We read the cached session from localStorage — the same key AuthContext
// writes to — so a logged-in user still sees their name, and an anonymous
// visitor just sees "Guest".

interface SessionUser {
  id?: string;
  name?: string;
  email?: string;
  picture?: string;
}

const SESSION_KEY = 'gstpilot_session';

/** Read the cached session user from localStorage. Safe on the client only —
 *  the /oracle route is dynamically imported with ssr:false, so this runs
 *  purely client-side. Lazy useState initializer avoids setState-in-effect. */
function readSessionUser(): SessionUser {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as SessionUser;
  } catch {
    /* non-fatal */
  }
  return {};
}

function useSessionUser(): SessionUser {
  // useState lazy initializer runs once on mount (client-only thanks to
  // dynamic ssr:false import) — no effect, no cascading render.
  const [user] = useState<SessionUser>(readSessionUser);
  return user;
}

// ─── Streaming helpers ────────────────────────────────────────────────────────

/**
 * SSE event shape emitted by /api/oracle/chat.
 * The API emits OracleStreamChunk-compatible frames:
 *   { token: string }       — a text token to append
 *   { done: true }          — stream complete
 *   { structured: ... }     — structured data card (optional, ignored by chat UI)
 *   { language: 'hi'|'en' } — detected language hint (optional, ignored)
 *   { error: string }       — error message (rare; the API usually sends a
 *                             token with the error text + done:true instead)
 */
interface StreamEvent {
  token?: string;
  done?: boolean;
  structured?: unknown;
  language?: string;
  error?: string;
}

/**
 * Posts a message to /api/oracle/chat and streams back tokens via SSE.
 * Calls onDelta for each token chunk, onFollowUps for suggestions, onSources
 * for the Sources Panel, and onDone when the stream closes.
 */
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
    onSources?: (sources: Array<{ key: string; label: string; recordCount: number; connected: boolean }>) => void;
    onDone: () => void;
    onError: (message: string) => void;
  },
  signal?: AbortSignal
): Promise<void> {
  try {
    // ── Build the OracleChatRequest payload ────────────────────────────────
    // The API expects { messages: [{role, content}], memory, context } — NOT
    // the legacy { message, history, userEmail } shape. We assemble the
    // messages array from prior history + the new user message, and include
    // memory + organizationId so the backend can personalize + scope queries.
    const messages = [
      ...payload.history.map((m) => ({
        role: (m.role === 'user' ? 'user' : 'oracle') as 'user' | 'oracle',
        content: m.content,
      })),
      { role: 'user' as const, content: payload.message },
    ];

    // Read the current org id from localStorage (set by OrgContext). This is
    // a client-only component (ssr:false dynamic import), so localStorage is
    // always available here.
    let organizationId: string | undefined;
    try {
      organizationId = window.localStorage.getItem('gstpilot_org_id') ?? undefined;
    } catch {
      /* private mode — non-fatal */
    }

    const apiPayload = {
      messages,
      memory: {
        userName: payload.userName,
        userId: payload.userId,
      },
      context: organizationId ? { organizationId } : undefined,
    };

    const res = await fetch('/api/oracle/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiPayload),
      signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => 'unknown error')}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line. Each event has lines like:
      //   data: {...}\n\n
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const evt of events) {
        const line = evt.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        const payloadStr = line.slice(5).trim();
        if (!payloadStr || payloadStr === '[DONE]') continue;

        try {
          const data = JSON.parse(payloadStr) as StreamEvent;
          // Token chunk — append to the streaming assistant message
          if (data.token) {
            handlers.onDelta(data.token);
          }
          // Stream complete — finalize
          if (data.done) {
            handlers.onDone();
            return;
          }
          // Explicit error frame (rare — the API usually sends a token + done)
          if (data.error) {
            handlers.onError(data.error);
            return;
          }
          // `structured` and `language` frames are ignored by this chat UI —
          // they're consumed by the richer OracleWorkspace component.
        } catch {
          // skip malformed event
        }
      }
    }
    // Stream ended without explicit 'done' — finalize anyway
    handlers.onDone();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      // User-initiated stop — treat as done
      handlers.onDone();
      return;
    }
    handlers.onError(err instanceof Error ? err.message : 'Network error');
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OracleChat() {
  const user = useSessionUser();
  const logout = () => {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* non-fatal */ }
    if (typeof window !== 'undefined') window.location.href = '/';
  };

  // Subscribe to reactive state for rendering. Mutations use
  // useOracleConversations.getState() inside async handlers to avoid stale
  // closures (see handleSend / handlePickSuggestion).
  const conversations = useOracleConversations((s) => s.conversations);
  const activeId = useOracleConversations((s) => s.activeId);
  const getActive = useOracleConversations((s) => s.getActive);
  const createConversation = useOracleConversations((s) => s.createConversation);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<OracleInputHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  // Refs read by async stream handlers (kept in sync via effects below)
  const isStreamingRef = useRef(false);

  // Keep a ref of the active conversation so async callbacks always read the
  // latest snapshot without becoming stale (avoids React Compiler manual-memo
  // warnings on `active` being a mutable object).
  const activeRef = useRef<ReturnType<typeof getActive>>(null);
  const active = getActive();

  // Sync refs in effects (never during render)
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const messages = active?.messages ?? [];
  const hasMessages = messages.length > 0;

  // ── Auto-scroll to bottom on new content (unless user scrolled up) ──
  useEffect(() => {
    if (!scrollRef.current || !shouldAutoScrollRef.current) return;
    const el = scrollRef.current;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // ── Sync Engine — auto-sync all connected connectors every 5 minutes ──
  // The first sync runs 30s after login (to not block initial render), then
  // every 5 minutes thereafter. Each sync pulls fresh data from connected
  // systems into the DB, so Oracle always reads the latest business state.
  useEffect(() => {
    let cancelled = false;

    const runSync = async () => {
      if (cancelled) return;
      try {
        await fetch('/api/integrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sync-all' }),
        });
      } catch {
        // Sync failures are silent — the user doesn't need to know the
        // background sync had an issue. The next interval will retry.
      }
    };

    // Initial sync after 30s, then every 5 minutes.
    const initialTimer = setTimeout(runSync, 30_000);
    const interval = setInterval(runSync, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    shouldAutoScrollRef.current = atBottom;
  };

  // ── Build history payload (only completed turns, exclude streaming one) ──
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

    // Ensure we have an active conversation. Always read the LATEST activeId
    // from the store (not the closure) — avoids stale-value bugs where two
    // conversations get created in the same tick.
    const store = useOracleConversations.getState();
    let convId = store.activeId;
    if (!convId) {
      convId = store.createConversation();
    }

    // Push user message + oracle placeholder
    const { oracleTurnId } = store.pushUserMessage(message);

    // Derive title if this is the first message
    store.ensureTitle(convId, message);

    // Build history (exclude the placeholder we just pushed)
    const history = buildHistoryPayload(oracleTurnId);

    setIsStreaming(true);
    isStreamingRef.current = true;
    shouldAutoScrollRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    await streamOracle(
      { message, history, userEmail: user?.email, userName: user?.name, userId: user?.id },
      {
        onDelta: (delta) => {
          store.appendDelta(oracleTurnId, delta);
        },
        onFollowUps: (prompts) => {
          store.setFollowUps(oracleTurnId, prompts);
        },
        onSources: (sources) => {
          store.setSources(oracleTurnId, sources);
        },
        onDone: () => {
          store.finalizeMessage(oracleTurnId);
          setIsStreaming(false);
          isStreamingRef.current = false;
          abortRef.current = null;
          // Refocus the input for the next message
          requestAnimationFrame(() => inputRef.current?.focus());
        },
        onError: (errorMessage) => {
          store.setError(oracleTurnId, errorMessage);
          setIsStreaming(false);
          isStreamingRef.current = false;
          abortRef.current = null;
          requestAnimationFrame(() => inputRef.current?.focus());
        },
      },
      controller.signal
    );
  };

  // ── Stop streaming ──
  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    isStreamingRef.current = false;
  };

  // ── Pick a suggestion from welcome screen or follow-up chip ──
  const handlePickSuggestion = (prompt: string) => {
    // If the active conversation already has messages, start a fresh one so
    // follow-up chip clicks begin a new thread (Perplexity-style).
    const store = useOracleConversations.getState();
    const current = store.getActive();
    if (current && current.messages.length > 0) {
      store.createConversation();
    }
    // Auto-send (Perplexity-style)
    requestAnimationFrame(() => {
      handleSend(prompt);
    });
  };

  // ── Retry the last oracle message ──
  const handleRetry = () => {
    const current = activeRef.current;
    if (!current || isStreamingRef.current) return;
    // Find the last user message and resend
    const lastUser = [...current.messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;

    // Simplest: just resend the user message — a new pair is pushed
    handleSend(lastUser.content);
  };

  // ── New conversation (from history drawer) ──
  const handleNewChat = () => {
    createConversation();
    setHistoryOpen(false);
  };

  const userInitials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'G';

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#000000] text-white">
      {/* ── Top bar — minimal, ChatGPT-style ── */}
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-[#1F1F1F] bg-[#000000]/80 px-3 backdrop-blur-xl md:px-5">
        {/* History drawer trigger */}
        <button
          onClick={() => setHistoryOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
          aria-label="Conversation history"
          title="History"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Wordmark + subtitle + model badge */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563EB]/10 ring-1 ring-[#2563EB]/30">
            <InfinitySymbol size={20} />
          </div>
          <div className="flex flex-col items-start leading-none">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-semibold tracking-tight text-white">
                Oracle
              </span>
              <span className="rounded-md border border-[#2563EB]/30 bg-[#2563EB]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#3B82F6]">
                GPT-4 class
              </span>
            </div>
            <span className="mt-0.5 text-[10px] font-medium text-white/45">
              Your AI business brain
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setInsightsOpen((o) => !o)}
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white lg:flex"
            aria-label="Toggle insights"
            title={insightsOpen ? 'Hide insights' : 'Show insights'}
          >
            {insightsOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setGraphOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
            aria-label="Business Graph"
            title="Business Graph"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setConnectorsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
            aria-label="Real Data Connectors"
            title="Real Data Connectors"
          >
            <Plug className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMemoryOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
            aria-label="Business Memory"
            title="Business Memory"
          >
            <Brain className="h-4 w-4" />
          </button>
          <button
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-1.5 py-1 outline-none transition-colors hover:bg-white/[0.05]">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.picture} alt={user?.name || 'User'} />
                <AvatarFallback className="bg-[#2563EB]/15 text-[11px] font-semibold text-[#3B82F6]">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center gap-2 p-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.picture} alt={user?.name || 'User'} />
                  <AvatarFallback className="bg-[#2563EB]/15 text-xs font-semibold text-[#3B82F6]">
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

      {/* ── Body: chat column + insights sidebar ── */}
      <div className="relative z-10 flex min-h-0 flex-1">
        {/* ── Chat column ── */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Scrollable message area */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="min-h-0 flex-1 overflow-y-auto custom-scrollbar"
          >
            {hasMessages ? (
              <div className="mx-auto w-full max-w-[768px] px-4 py-6 sm:px-6">
                <div className="space-y-6">
                  {messages.map((turn) => (
                    <OracleMessage
                      key={turn.id}
                      turn={turn}
                      onPickFollowUp={handlePickSuggestion}
                      onRetry={turn.role === 'oracle' && turn.id === messages[messages.length - 1]?.id ? handleRetry : undefined}
                    />
                  ))}
                </div>
                {/* Spacer at the bottom so the last message isn't flush to the input */}
                <div className="h-8" />
              </div>
            ) : (
              <div className="mx-auto w-full max-w-[768px] px-4 py-6 sm:px-6">
                <OracleEmptyState onPick={handlePickSuggestion} userName={user?.name} />
              </div>
            )}
          </div>

          {/* ── Sticky input area (ChatGPT-style fixed bottom) ── */}
          <div className="shrink-0 bg-gradient-to-t from-[#000000] via-[#000000]/95 to-transparent px-4 pb-4 pt-3 sm:px-6">
            <div className="mx-auto w-full max-w-[768px]">
              <OracleInput
                ref={inputRef}
                onSend={handleSend}
                onStop={handleStop}
                isStreaming={isStreaming}
              />
              <p className="mt-2 text-center text-[10.5px] text-white/35">
                Oracle is a GST · CFO · Compliance assistant. Always verify critical
                tax decisions with a qualified professional.
              </p>
            </div>
          </div>
        </main>

        {/* ── Insights sidebar (right column, collapsible, desktop-only) ── */}
        <AnimatePresence>
          {insightsOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="relative z-10 hidden w-80 shrink-0 border-l border-[#1F1F1F] bg-[#0A0A0A] lg:block"
            >
              <InsightsSidebar onAskOracle={handlePickSuggestion} />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* ── History drawer (slide-in, triggered by Menu button) ── */}
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
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
              >
                <Plus className="h-4 w-4" />
                New Conversation
              </button>
              <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
                {conversations.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-white/40">
                    No conversations yet
                  </p>
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

      {/* ── Business Memory slide-in panel ── */}
      <MemoryPanel
        open={memoryOpen}
        onClose={() => setMemoryOpen(false)}
        userEmail={user?.email}
      />

      {/* ── Real Data Connectors slide-in panel ── */}
      <ConnectorsPanel
        open={connectorsOpen}
        onClose={() => setConnectorsOpen(false)}
      />

      {/* ── Business Graph full-screen overlay ── */}
      <BusinessGraphPanel
        open={graphOpen}
        onClose={() => setGraphOpen(false)}
        onOpenConnectors={() => { setGraphOpen(false); setConnectorsOpen(true); }}
      />
    </div>
  );
}

// ─── Insights sidebar (right column — ChatGPT-Enterprise-style cards) ─────────
// Clean cards with eyebrow labels (uppercase 10px tracking), large numbers
// (text-2xl font-bold tabular), and a "View details" link on each. Static
// content — the live Executive Brief lives in its own component so it can be
// used in contexts that have an OrgProvider (the dashboard workspace).

function InsightsSidebar({ onAskOracle }: { onAskOracle: (prompt: string) => void }) {
  const insights: {
    eyebrow: string;
    title: string;
    value: string;
    detail: string;
    prompt: string;
  }[] = [
    {
      eyebrow: 'Today',
      title: 'What should I prioritize today?',
      value: '3',
      detail: 'high-impact actions queued',
      prompt: 'What should I prioritize today?',
    },
    {
      eyebrow: 'Cash',
      title: 'Cash position snapshot',
      value: '₹—',
      detail: 'connect bank to enable',
      prompt: 'What is my cash position right now?',
    },
    {
      eyebrow: 'Compliance',
      title: 'GST & return readiness',
      value: '0',
      detail: 'overdue returns',
      prompt: 'Show me my overdue returns',
    },
    {
      eyebrow: 'Risk',
      title: 'Clients at risk',
      value: '—',
      detail: 'connect CRM to enable',
      prompt: 'Which clients are at risk?',
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[#1F1F1F] px-5 py-3.5">
        <div className="flex flex-col leading-none">
          <span className="text-[13px] font-semibold tracking-tight text-white">Insights</span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-white/40">
            Executive brief
          </span>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
        {insights.map((card, i) => (
          <div
            key={i}
            className="rounded-xl border border-[#1F1F1F] bg-[#111111] p-4 transition-colors hover:border-[#2A2A2A]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                {card.eyebrow}
              </span>
              <span className="text-2xl font-bold tabular-nums text-white">
                {card.value}
              </span>
            </div>
            <p className="mt-2 text-[13px] font-medium leading-snug text-white">
              {card.title}
            </p>
            <p className="mt-1 text-[11px] text-white/50">{card.detail}</p>
            <button
              onClick={() => onAskOracle(card.prompt)}
              className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-[#3B82F6] transition-colors hover:text-[#60A5FA]"
            >
              View details
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        ))}

        {/* Quick-action prompts */}
        <div className="rounded-xl border border-[#1F1F1F] bg-[#111111] p-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Try asking
          </span>
          <div className="mt-2 space-y-1.5">
            {[
              'Show overdue returns',
              'Which clients are at risk?',
              'Cash flow summary',
              'What should I prioritize today?',
            ].map((q) => (
              <button
                key={q}
                onClick={() => onAskOracle(q)}
                className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-[12px] text-white/70 transition-colors hover:bg-white/[0.04] hover:text-white"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <p className="px-1 pt-2 text-center text-[10px] leading-relaxed text-white/35">
          Oracle · Your AI business brain
        </p>
      </div>
    </div>
  );
}

export default OracleChat;
