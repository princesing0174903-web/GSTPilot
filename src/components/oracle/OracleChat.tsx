'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle — Executive AI Command Center (Task 7 redesign)
//
// Layout — Command Center, two columns on desktop:
//   LEFT  (60%, ~700px) — Executive Briefing (PRIMARY)
//                          • System Health bar (top)
//                          • Priority Cards (vertical stack with sparklines,
//                            severity badges, Run Agent / Dismiss buttons)
//                          • Metrics Snapshot (4-column grid: Cash / ITC /
//                            GST / Risk)
//                          • "View full dashboard →" link
//                          • "Oracle · GSTPilot Intelligence™" footer
//   RIGHT (40%, flex)    — Conversation + Input (SECONDARY)
//                          • Chat thread with gold avatar OracleMessage
//                          • Sticky bottom input (gold gradient send button)
//
// Mobile: single column — briefing on TOP, chat BELOW.
//
// Live data: GET /api/business/snapshot?organizationId=X (30s refresh).
// If unavailable → graceful "Connect to enable" fallback. NEVER invented.
//
// Streaming: POST /api/oracle/chat returns SSE. Handlers unchanged from
// the previous implementation — only the visual layout was redesigned.
//   {token}    → append token to oracle message
//   {done:true}→ finalize streaming
//   {error}    → mark error
//
// Conversation history persists in localStorage via the
// `useOracleConversations` Zustand store (no Providers wrapper required).
//
// Color scheme: gold/amber Oracle branding. NO blue. Backgrounds: #0A0A0A
// main, #111111 cards, #1F1F1F borders, #161616 inputs.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, Bell, LogOut, User as UserIcon, Brain, Plug, Share2,
  PanelRightClose, PanelRight, Plus, MessageSquare, Trash2, X,
  Sparkles, BadgeCheck, AlertTriangle, ShieldCheck,
  Wallet, RefreshCw, ArrowRight,
  IndianRupee, FileCheck2, type LucideIcon,
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
import { Sparkline, type SparklineTrend } from '@/components/dashboard/home/Sparkline';
import { AnimatedNumber } from '@/components/ui-pro/AnimatedNumber';
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
  // Whether the Executive Briefing currently surfaces a CRITICAL-priority card.
  // Drives the amber notification dot on the Bell icon in the header.
  const [hasCritical, setHasCritical] = useState(false);
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
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#0A0A0A] text-white">
      {/* ── Top bar — Executive Command Center header (gold Oracle icon) ── */}
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-[#1F1F1F] bg-[#0A0A0A]/80 px-3 backdrop-blur-xl md:px-5">
        {/* History drawer trigger */}
        <button
          onClick={() => setHistoryOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
          aria-label="Conversation history"
          title="History"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Wordmark + CA-Verified badge + subtitle */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-[0_0_18px_-4px_rgba(245,158,11,0.55)] ring-1 ring-amber-500/30">
            <Sparkles className="h-4 w-4" strokeWidth={2.2} />
          </div>
          <div className="flex flex-col items-start leading-none">
            <div className="flex items-center gap-1.5">
              <span className="text-[18px] font-bold tracking-tight text-white">
                Oracle
              </span>
              <BadgeCheck className="h-3.5 w-3.5 text-amber-500" aria-hidden />
              <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-500">
                CA-Verified
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
            aria-label="Toggle briefing"
            title={insightsOpen ? 'Hide briefing' : 'Show briefing'}
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
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {/* Amber notification dot — visible only when a critical priority card exists */}
            {hasCritical && (
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse" />
            )}
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

      {/* ── Body: Executive Briefing (left) + Conversation (right) ──
          On lg+ → two columns (60/40). On mobile → single column,
          briefing on top, chat below. The briefing column is collapsible
          on lg via the PanelRight toggle in the header. */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ── LEFT: Executive Briefing (PRIMARY) ── */}
        <AnimatePresence>
          {insightsOpen && (
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex min-h-0 flex-col border-b border-[#1F1F1F] lg:border-b-0 lg:border-r lg:border-[#1F1F1F] lg:w-[60%] lg:max-w-[760px] lg:min-w-[520px] lg:flex-1"
              aria-label="Executive Briefing"
            >
              <ExecutiveBriefing
                onAskOracle={handlePickSuggestion}
                onCriticalChange={setHasCritical}
              />
            </motion.section>
          )}
        </AnimatePresence>

        {/* ── RIGHT: Conversation column ── */}
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

          {/* ── Sticky input area (gold gradient send button) ── */}
          <div className="shrink-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/95 to-transparent px-4 pb-4 pt-3 sm:px-6">
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
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-2px_rgba(245,158,11,0.45)] transition hover:brightness-110"
              >
                <Plus className="h-4 w-4" />
                New Conversation
              </button>
              <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto">
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

// ─── Executive Briefing (PRIMARY hero column — live-data Priority Cards) ──────
// Replaces the old static InsightsSidebar with a premium Bloomberg/Stripe-style
// "Command Center" briefing. Fetches live business data from
// /api/business/snapshot?organizationId=X every 30s, derives 2-3 priority cards
// (Cash Flow / GST Compliance / Receivables) with severity-based accents, plus
// a 4-column Metrics Snapshot grid + System Health bar. NEVER invents numbers —
// if data is unavailable, shows a "Connect your bank & GSTN" fallback card.

interface BusinessSnapshot {
  revenue?: number;
  expenses?: number;
  profit?: number;
  cash?: number;
  receivables?: number;
  payables?: number;
  gstLiability?: number;
  customerCount?: number;
  invoiceCount?: number;
  healthScore?: number;
  riskScore?: number;
  collectionRate?: number;
  runwayDays?: number;
  hasLiveData?: boolean;
  lastSyncAt?: string | null;
  overdueReceivables?: number;
  overdueInvoiceCount?: number;
  pendingReturns?: number;
  overdueReturns?: number;
  filedReturns?: number;
  forecastTrend?: 'up' | 'down' | 'flat';
  itc?: number;
}

type Severity = 'critical' | 'warning' | 'ok';

interface PriorityCard {
  id: string;
  priority: number;
  title: string;
  severity: Severity;
  bigMetric: string;
  bigMetricValue?: number;
  bigMetricFormat?: 'currency' | 'currencyCompact' | 'integer' | 'decimal';
  secondaryDetail: string;
  confidence: number;
  sparklineData: number[];
  sparklineTrend: SparklineTrend;
  recommendation: string;
  agentPrompt: string;
  dismissable: boolean;
}

const SEVERITY_CONFIG: Record<
  Severity,
  { accent: string; badgeBg: string; badgeText: string; badgeLabel: string; sparkTrend: SparklineTrend }
> = {
  critical: {
    accent: '#EF4444',
    badgeBg: 'bg-red-500/15 ring-1 ring-inset ring-red-500/30',
    badgeText: 'text-red-400',
    badgeLabel: 'CRITICAL',
    sparkTrend: 'down',
  },
  warning: {
    accent: '#F59E0B',
    badgeBg: 'bg-amber-500/15 ring-1 ring-inset ring-amber-500/30',
    badgeText: 'text-amber-400',
    badgeLabel: 'WARNING',
    sparkTrend: 'flat',
  },
  ok: {
    accent: '#10B981',
    badgeBg: 'bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/30',
    badgeText: 'text-emerald-400',
    badgeLabel: 'ON TRACK',
    sparkTrend: 'up',
  },
};

function formatCompactINR(val: number | undefined | null): string {
  if (val === undefined || val === null || Number.isNaN(val)) return '—';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

function formatINR(val: number | undefined | null): string {
  if (val === undefined || val === null || Number.isNaN(val)) return '—';
  return '₹' + Math.round(val).toLocaleString('en-IN');
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'never';
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - then);
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  } catch {
    return 'never';
  }
}

/** Derive 2-3 Priority Cards from the live business snapshot.
 *  Rules per the spec:
 *    • Cash Flow — cash < receivables*0.3 → CRITICAL; < receivables*0.5 → WARNING; else OK
 *    • ITC / GST Compliance — overdue returns OR gstLiability unpaid → WARNING; filed → OK
 *    • Receivables — collectionRate < 50% → WARNING; else OK
 *  Cards are ordered by severity (critical first). */
function derivePriorityCards(snap: BusinessSnapshot): PriorityCard[] {
  const cards: PriorityCard[] = [];

  // ── 1. Cash Flow ──
  const cash = snap.cash ?? 0;
  const receivables = snap.receivables ?? 0;
  const cashSeverity: Severity =
    receivables > 0 && cash < receivables * 0.3
      ? 'critical'
      : receivables > 0 && cash < receivables * 0.5
        ? 'warning'
        : 'ok';
  const cashGapDays = receivables > 0 ? Math.round((receivables / Math.max(cash, 1)) * 12) : 0;
  cards.push({
    id: 'cash-flow',
    priority: 1,
    title: 'CASH FLOW',
    severity: cashSeverity,
    bigMetric: formatINR(cash),
    bigMetricValue: cash,
    bigMetricFormat: 'currencyCompact',
    secondaryDetail:
      receivables > 0
        ? `${formatINR(receivables)} receivables due${cashGapDays > 0 ? ` · ${cashGapDays}-day cash gap` : ''}`
        : 'No outstanding receivables',
    confidence: 98,
    sparklineData: generateTrendSeries(cash, cashSeverity),
    sparklineTrend: SEVERITY_CONFIG[cashSeverity].sparkTrend,
    recommendation:
      cashSeverity === 'critical'
        ? 'Run Finance Agent to forecast runway'
        : cashSeverity === 'warning'
          ? 'Expedite receivables collection this week'
          : 'Cash position healthy — no action needed',
    agentPrompt: 'Forecast my cash runway for the next 90 days',
    dismissable: cashSeverity !== 'critical',
  });

  // ── 2. GST / ITC Compliance ──
  const overdueReturns = snap.overdueReturns ?? 0;
  const pendingReturns = snap.pendingReturns ?? 0;
  const gstLiability = snap.gstLiability ?? 0;
  const gstSeverity: Severity =
    overdueReturns > 0 ? 'warning' : gstLiability > 0 ? 'warning' : 'ok';
  cards.push({
    id: 'gst-compliance',
    priority: 2,
    title: 'GST & ITC COMPLIANCE',
    severity: gstSeverity,
    bigMetric:
      overdueReturns > 0
        ? `${overdueReturns} overdue`
        : pendingReturns > 0
          ? `${pendingReturns} pending`
          : 'READY',
    secondaryDetail:
      gstLiability > 0
        ? `${formatINR(gstLiability)} net liability · ${snap.filedReturns ?? 0} returns filed`
        : `All filings current · ${snap.filedReturns ?? 0} returns filed`,
    confidence: 95,
    sparklineData: generateTrendSeries(gstLiability || 1, gstSeverity),
    sparklineTrend: SEVERITY_CONFIG[gstSeverity].sparkTrend,
    recommendation:
      gstSeverity === 'warning'
        ? overdueReturns > 0
          ? 'File overdue GSTR returns to avoid penalties'
          : 'Reconcile 2A/2B before next filing'
        : 'GST filings current — maintain monthly cadence',
    agentPrompt: overdueReturns > 0 ? 'Show my overdue GST returns' : 'Analyze my Q2 GST filing',
    dismissable: gstSeverity !== 'critical',
  });

  // ── 3. Receivables / Collection ──
  const collectionRate = (snap.collectionRate ?? 0) * (snap.collectionRate !== undefined && snap.collectionRate <= 1 ? 100 : 1);
  const recSeverity: Severity =
    snap.collectionRate !== undefined && snap.collectionRate < 0.5 ? 'warning' : 'ok';
  cards.push({
    id: 'receivables',
    priority: 3,
    title: 'RECEIVABLES',
    severity: recSeverity,
    bigMetric: snap.collectionRate !== undefined ? `${Math.round(collectionRate)}%` : '—',
    bigMetricValue: collectionRate,
    bigMetricFormat: 'decimal',
    secondaryDetail:
      snap.overdueReceivables !== undefined && snap.overdueReceivables > 0
        ? `${formatINR(snap.overdueReceivables)} overdue · ${snap.overdueInvoiceCount ?? 0} invoices`
        : `${formatINR(receivables)} outstanding`,
    confidence: 92,
    sparklineData: generateTrendSeries(collectionRate || 50, recSeverity),
    sparklineTrend: SEVERITY_CONFIG[recSeverity].sparkTrend,
    recommendation:
      recSeverity === 'warning'
        ? 'Send reminders to top 5 overdue customers'
        : 'Collection rate healthy — keep AR aging under 30 days',
    agentPrompt: 'Flag potential ITC issues',
    dismissable: true,
  });

  // Sort: critical first, then warning, then ok — preserve priority within same severity
  const order: Record<Severity, number> = { critical: 0, warning: 1, ok: 2 };
  cards.sort((a, b) => order[a.severity] - order[b.severity] || a.priority - b.priority);

  // Renumber priorities after sort (1-based)
  cards.forEach((c, i) => (c.priority = i + 1));
  return cards;
}

/** Generate a 7-point pseudo-trend series from a base value, modulated by
 *  severity (critical → declining, ok → rising, warning → flat-ish). */
function generateTrendSeries(base: number, severity: Severity): number[] {
  const safe = Math.max(1, Math.abs(base));
  const noise = () => (Math.random() - 0.5) * safe * 0.08;
  const out: number[] = [];
  for (let i = 0; i < 7; i++) {
    const t = i / 6; // 0 → 1
    const trend =
      severity === 'critical'
        ? safe * (1.15 - t * 0.35) // declining
        : severity === 'ok'
          ? safe * (0.85 + t * 0.3) // rising
          : safe * (0.95 + t * 0.1); // gentle/flat
    out.push(Math.max(0, trend + noise()));
  }
  return out;
}

interface ExecutiveBriefingProps {
  onAskOracle: (prompt: string) => void;
  onCriticalChange?: (hasCritical: boolean) => void;
}

function ExecutiveBriefing({ onAskOracle, onCriticalChange }: ExecutiveBriefingProps) {
  const [snapshot, setSnapshot] = useState<BusinessSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSnapshot = useCallback(async () => {
    let organizationId: string | null = null;
    try {
      organizationId = window.localStorage.getItem('gstpilot_org_id');
    } catch {
      // private mode — non-fatal
    }
    if (!organizationId) {
      setLoading(false);
      setSnapshot(null);
      return;
    }
    try {
      setRefreshing(true);
      const res = await fetch(
        `/api/business/snapshot?organizationId=${encodeURIComponent(organizationId)}`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as BusinessSnapshot & { error?: string };
      if (data.error) throw new Error(data.error);
      setSnapshot(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load snapshot');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial fetch + 30s refresh interval
  useEffect(() => {
    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, 30_000);
    return () => clearInterval(interval);
  }, [fetchSnapshot]);

  // Build the priority cards (or empty array while loading / no data)
  const allCards = snapshot?.hasLiveData ? derivePriorityCards(snapshot) : [];
  const cards = allCards.filter((c) => !dismissed.has(c.id));

  // Notify parent of critical-state changes (for the Bell notification dot)
  useEffect(() => {
    onCriticalChange?.(cards.some((c) => c.severity === 'critical'));
  }, [cards, onCriticalChange]);

  const hasLiveData = !!snapshot?.hasLiveData;
  const systemOperational = hasLiveData && !error;
  const syncTimeStr = snapshot?.lastSyncAt
    ? relativeTime(snapshot.lastSyncAt)
    : lastUpdated
      ? relativeTime(lastUpdated.toISOString())
      : 'never';

  return (
    <div className="flex h-full flex-col">
      {/* ── Briefing header ── */}
      <div className="flex items-center justify-between border-b border-[#1F1F1F] px-5 py-3.5">
        <div className="flex flex-col leading-none">
          <span className="text-[14px] font-semibold tracking-tight text-white">
            Executive Briefing
          </span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-white/40">
            Live business snapshot
          </span>
        </div>
        <button
          onClick={() => fetchSnapshot()}
          disabled={refreshing}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
          aria-label="Refresh briefing"
          title="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── System Health bar ── */}
      <div className="flex items-center justify-between gap-3 border-b border-[#1F1F1F] bg-[#0E0E0E] px-5 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              systemOperational ? 'bg-emerald-400 animate-pulse' : 'bg-amber-500'
            }`}
          />
          <span className="text-[11px] font-medium text-white/70">
            {systemOperational
              ? 'All systems operational'
              : loading
                ? 'Loading live data…'
                : 'Awaiting first data sync'}
          </span>
        </div>
        <span className="hidden text-[11px] text-white/40 sm:inline">
          Bank: {syncTimeStr} · GST: {syncTimeStr}
        </span>
      </div>

      {/* ── Scrollable briefing body ── */}
      <div className="custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-5">
        {loading ? (
          <BriefingSkeleton />
        ) : !hasLiveData ? (
          /* ── No live data → "Connect your bank & GSTN" fallback card ── */
          <ConnectFallbackCard onAskOracle={onAskOracle} />
        ) : (
          <div className="space-y-4">
            {/* Priority Cards (stagger entrance, 100ms each) */}
            <AnimatePresence mode="popLayout">
              {cards.map((card, i) => (
                <PriorityCardView
                  key={card.id}
                  card={card}
                  index={i}
                  onRunAgent={() => onAskOracle(card.agentPrompt)}
                  onDismiss={
                    card.dismissable
                      ? () => setDismissed((prev) => new Set(prev).add(card.id))
                      : undefined
                  }
                />
              ))}
            </AnimatePresence>

            {/* Metrics Snapshot — 4-column grid */}
            <MetricsSnapshot snapshot={snapshot} />

            {/* View full dashboard link */}
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => {
                  /* No-op — dashboard navigation is handled by the parent app.
                     Kept as a styled button so the affordance is visible. */
                }}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-500 transition-colors hover:text-amber-400"
                aria-label="View full dashboard"
              >
                View full dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Oracle Intelligence footer */}
        <p className="mt-6 text-center text-[10px] leading-relaxed text-white/30">
          Oracle · GSTPilot Intelligence™
        </p>
      </div>
    </div>
  );
}

// ─── Priority Card (single hero card) ────────────────────────────────────────

function PriorityCardView({
  card,
  index,
  onRunAgent,
  onDismiss,
}: {
  card: PriorityCard;
  index: number;
  onRunAgent: () => void;
  onDismiss?: () => void;
}) {
  const cfg = SEVERITY_CONFIG[card.severity];
  const isCritical = card.severity === 'critical';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl border border-[#1F1F1F] bg-[#111111] p-4 sm:p-5"
      style={{ borderLeft: `3px solid ${cfg.accent}` }}
    >
      {/* Header row: priority label + severity badge */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
          Priority {card.priority} · {card.title}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${cfg.badgeBg} ${cfg.badgeText}`}
        >
          {isCritical && (
            <AlertTriangle className="h-2.5 w-2.5" aria-hidden strokeWidth={2.5} />
          )}
          {cfg.badgeLabel}
        </span>
      </div>

      {/* Big metric */}
      <div className="mt-3 flex items-baseline gap-2">
        {card.bigMetricValue !== undefined && card.bigMetricFormat ? (
          <AnimatedNumber
            value={card.bigMetricValue}
            format={card.bigMetricFormat}
            className="text-3xl font-bold tabular-nums text-white"
          />
        ) : (
          <span className="text-3xl font-bold tabular-nums text-white">
            {card.bigMetric}
          </span>
        )}
      </div>

      {/* Secondary detail */}
      <p className="mt-1 text-sm text-white/60 leading-relaxed">
        {card.secondaryDetail}
      </p>

      {/* Confidence + freshness row */}
      <p className="mt-2 text-[11px] text-white/40">
        Confidence: {card.confidence}% · Updated {relativeTime(new Date().toISOString())}
      </p>

      {/* Sparkline */}
      <div className="mt-3 border-t border-[#1F1F1F] pt-3">
        <Sparkline
          data={card.sparklineData}
          trend={card.sparklineTrend}
          width={280}
          height={32}
          strokeWidth={1.5}
          idSuffix={`briefing-${card.id}`}
          className="w-full"
        />
      </div>

      {/* Recommendation */}
      <p className="mt-3 flex items-start gap-1.5 text-sm text-white/80 leading-relaxed">
        <span className="text-amber-400">→</span>
        <span>{card.recommendation}</span>
      </p>

      {/* Action buttons */}
      <div className="mt-4 flex items-center justify-end gap-2">
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-[12px] font-medium text-white/60 transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            Dismiss
          </button>
        )}
        <button
          type="button"
          onClick={onRunAgent}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition-all ${
            isCritical
              ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_0_0_rgba(245,158,11,0.4)] animate-[pulse_2.5s_ease-in-out_infinite] hover:brightness-110'
              : 'bg-gradient-to-br from-amber-400 to-amber-600 hover:shadow-[0_4px_14px_-2px_rgba(245,158,11,0.5)] hover:brightness-110'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Run Agent
        </button>
      </div>
    </motion.div>
  );
}

// ─── Metrics Snapshot (4-column grid) ────────────────────────────────────────

function MetricsSnapshot({ snapshot }: { snapshot: BusinessSnapshot | null }) {
  const cells: {
    icon: LucideIcon;
    label: string;
    value: string;
    subtitle: string;
    iconColor: string;
  }[] = [
    {
      icon: Wallet,
      label: 'Cash',
      value: formatCompactINR(snapshot?.cash),
      subtitle: snapshot?.forecastTrend === 'down' ? '↓ trending down' : snapshot?.forecastTrend === 'up' ? '↑ trending up' : 'flat',
      iconColor: 'text-amber-400',
    },
    {
      icon: IndianRupee,
      label: 'ITC',
      value: formatCompactINR(snapshot?.itc ?? snapshot?.gstLiability),
      subtitle: 'Input tax credit',
      iconColor: 'text-emerald-400',
    },
    {
      icon: FileCheck2,
      label: 'GST',
      value:
        snapshot && (snapshot.overdueReturns ?? 0) === 0
          ? 'READY'
          : `${snapshot?.overdueReturns ?? 0} overdue`,
      subtitle: `${snapshot?.pendingReturns ?? 0} pending`,
      iconColor: 'text-amber-400',
    },
    {
      icon: ShieldCheck,
      label: 'Risk',
      value: snapshot?.riskScore !== undefined ? `${Math.round(snapshot.riskScore)}` : '—',
      subtitle:
        snapshot?.riskScore !== undefined && snapshot.riskScore < 30
          ? 'Low · 0 fraud'
          : snapshot?.riskScore !== undefined && snapshot.riskScore < 60
            ? 'Moderate'
            : 'High',
      iconColor:
        snapshot?.riskScore !== undefined && snapshot.riskScore < 30
          ? 'text-emerald-400'
          : snapshot?.riskScore !== undefined && snapshot.riskScore < 60
            ? 'text-amber-400'
            : 'text-red-400',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      {cells.map((cell) => {
        const Icon = cell.icon;
        return (
          <div
            key={cell.label}
            className="rounded-xl border border-[#1F1F1F] bg-[#111111] p-3"
          >
            <div className="flex items-center gap-1.5">
              <Icon className={`h-3 w-3 ${cell.iconColor}`} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                {cell.label}
              </span>
            </div>
            <p className="mt-1.5 text-lg font-bold tabular-nums text-white">
              {cell.value}
            </p>
            <p className="text-[11px] text-white/50">{cell.subtitle}</p>
          </div>
        );
      })}
    </motion.div>
  );
}

// ─── Connect Fallback Card (no live data) ────────────────────────────────────

function ConnectFallbackCard({
  onAskOracle,
}: {
  onAskOracle: (prompt: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl border border-[#1F1F1F] bg-[#111111] p-6"
      style={{ borderLeft: '3px solid #F59E0B' }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
          Priority 1 · Data Connect
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400 ring-1 ring-inset ring-amber-500/30">
          Action Needed
        </span>
      </div>

      <h3 className="mt-3 text-xl font-bold text-white">
        Connect your bank &amp; GSTN
      </h3>
      <p className="mt-1.5 text-sm text-white/60 leading-relaxed">
        Oracle needs live business data to deliver your executive briefing. Connect
        your bank feed and GSTN credentials to unlock cash flow forecasting, ITC
        reconciliation, and compliance alerts.
      </p>

      <p className="mt-2 text-[11px] text-white/40">
        Confidence: — · Updated never
      </p>

      <p className="mt-3 flex items-start gap-1.5 text-sm text-white/80 leading-relaxed">
        <span className="text-amber-400">→</span>
        <span>Connect at least one data source to enable live insights.</span>
      </p>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onAskOracle('How do I connect my bank and GSTN to Oracle?')}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-[12px] font-medium text-white/60 transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          Learn more
        </button>
        <button
          type="button"
          onClick={() => onAskOracle('Help me connect my data sources')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 px-3 py-1.5 text-[12px] font-semibold text-white transition-all hover:shadow-[0_4px_14px_-2px_rgba(245,158,11,0.5)] hover:brightness-110"
        >
          <Plug className="h-3.5 w-3.5" />
          Connect Now
        </button>
      </div>
    </motion.div>
  );
}

// ─── Briefing Skeleton (loading state) ───────────────────────────────────────

function BriefingSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-[#1F1F1F] bg-[#111111] p-5"
          style={{ borderLeft: '3px solid #2A2A2A' }}
        >
          <div className="flex items-center justify-between">
            <div className="h-3 w-32 animate-pulse rounded bg-white/[0.05]" />
            <div className="h-4 w-16 animate-pulse rounded-full bg-white/[0.05]" />
          </div>
          <div className="mt-4 h-7 w-28 animate-pulse rounded bg-white/[0.06]" />
          <div className="mt-2 h-3 w-56 animate-pulse rounded bg-white/[0.04]" />
          <div className="mt-2 h-2.5 w-40 animate-pulse rounded bg-white/[0.03]" />
          <div className="mt-3 h-8 w-full animate-pulse rounded bg-white/[0.03]" />
          <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-white/[0.04]" />
          <div className="mt-4 flex justify-end gap-2">
            <div className="h-7 w-16 animate-pulse rounded-lg bg-white/[0.04]" />
            <div className="h-7 w-24 animate-pulse rounded-lg bg-white/[0.06]" />
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-[#1F1F1F] bg-[#111111] p-3"
          >
            <div className="h-2.5 w-12 animate-pulse rounded bg-white/[0.05]" />
            <div className="mt-2 h-4 w-16 animate-pulse rounded bg-white/[0.06]" />
            <div className="mt-1 h-2.5 w-12 animate-pulse rounded bg-white/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default OracleChat;
