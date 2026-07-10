'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Main Full-Screen Chat Component
//
// Three-zone layout (all full-screen, no dashboards):
//   LEFT    264px   — conversation history (collapsible)
//   CENTER  flex    — welcome screen OR message list (max-width 800px, centered)
//   BOTTOM  sticky  — glowing Oracle input box
//
// Streaming: POST /api/oracle/chat returns SSE.
//   {type:'delta',content}      → append token to oracle message
//   {type:'followups',prompts}  → attach suggestions to oracle message
//   {type:'done'}               → finalize streaming
//   {type:'error',message}      → mark error
//
// Conversation history persists in localStorage via oracle-conversations store.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Bell, Sun, Moon, LogOut, User as UserIcon, Brain, Plug, Share2 } from 'lucide-react';
import { useTheme } from 'next-themes';
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
import { useAuth } from '@/contexts/AuthContext';
import { useOracleConversations } from '@/lib/oracle-conversations';
import { InfinitySymbol } from '@/components/layout/InfinityMark';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { OracleWelcome } from './OracleWelcome';
import { OracleInput, type OracleInputHandle } from './OracleInput';
import { OracleMessage } from './OracleMessage';
import { OracleHistory } from './OracleHistory';
import { MemoryPanel } from './MemoryPanel';
import { ConnectorsPanel } from './ConnectorsPanel';
import { BusinessGraphPanel } from './BusinessGraphPanel';

// ─── Streaming helpers ────────────────────────────────────────────────────────

interface StreamEvent {
  type: 'delta' | 'followups' | 'done' | 'error' | 'sources';
  content?: string;
  prompts?: string[];
  message?: string;
  sources?: Array<{ key: string; label: string; recordCount: number; connected: boolean }>;
}

/**
 * Posts a message to /api/oracle/chat and streams back tokens via SSE.
 * Calls onDelta for each token chunk, onFollowUps for suggestions, onSources
 * for the Sources Panel™, and onDone when the stream closes.
 */
async function streamOracle(
  payload: { message: string; history: { role: 'user' | 'assistant'; content: string }[]; userEmail?: string },
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
    const res = await fetch('/api/oracle/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
          switch (data.type) {
            case 'delta':
              if (data.content) handlers.onDelta(data.content);
              break;
            case 'followups':
              if (data.prompts) handlers.onFollowUps(data.prompts);
              break;
            case 'sources':
              if (data.sources && handlers.onSources) handlers.onSources(data.sources);
              break;
            case 'done':
              handlers.onDone();
              return;
            case 'error':
              handlers.onError(data.message || 'Unknown error');
              return;
          }
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
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  // Subscribe to reactive state for rendering. Mutations use
  // useOracleConversations.getState() inside async handlers to avoid stale
  // closures (see handleSend / handlePickSuggestion).
  const conversations = useOracleConversations((s) => s.conversations);
  const activeId = useOracleConversations((s) => s.activeId);
  const getActive = useOracleConversations((s) => s.getActive);

  const [historyCollapsed, setHistoryCollapsed] = useState(false);
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

  // ── Sync Engine™ — auto-sync all connected connectors every 5 minutes ──
  // The first sync runs 30s after login (to not block initial render), then
  // every 5 minutes thereafter. Each sync pulls fresh data from connected
  // systems into the DB, so Oracle always reads the latest business state.
  useEffect(() => {
    if (!user) return;
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
  }, [user]);

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
      { message, history, userEmail: user?.email },
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

  const userInitials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      <AmbientBackground />

      {/* ── Top bar (minimal — just brand + profile) ── */}
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-background/60 px-3 backdrop-blur-xl md:px-4">
        <button
          onClick={() => setHistoryCollapsed((c) => !c)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground md:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2.5">
          <InfinitySymbol size={26} />
          <div className="hidden flex-col items-start leading-none sm:flex">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              GSTPilot <span className="accent-text">Oracle</span>
              <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">™</span>
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">
              The Financial Brain of India
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setGraphOpen(true)}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
            aria-label="Business Graph"
            title="Business Graph™"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setConnectorsOpen(true)}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
            aria-label="Real Data Connectors"
            title="Real Data Connectors™"
          >
            <Plug className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMemoryOpen(true)}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
            aria-label="Business Memory"
            title="Business Memory™"
          >
            <Brain className="h-4 w-4" />
          </button>
          <button
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#00F5D4]" />
          </button>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-1.5 py-1 outline-none transition-colors hover:bg-white/[0.05]">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.picture} alt={user?.name || 'User'} />
                <AvatarFallback className="accent-gradient-soft accent-text text-[11px] font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-xs font-medium text-foreground sm:inline">
                {user?.name?.split(' ')[0] || 'User'}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center gap-2 p-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.picture} alt={user?.name || 'User'} />
                  <AvatarFallback className="accent-gradient-soft accent-text text-xs font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
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

      {/* ── Body: history sidebar + chat area ── */}
      <div className="relative z-10 flex min-h-0 flex-1">
        {/* History sidebar (desktop) */}
        <div className="hidden md:block">
          <OracleHistory collapsed={historyCollapsed} onToggle={() => setHistoryCollapsed((c) => !c)} />
        </div>

        {/* Mobile history drawer */}
        <AnimatePresence>
          {historyCollapsed === false && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 md:hidden"
              onClick={() => setHistoryCollapsed(true)}
            >
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
              <motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="absolute left-0 top-0 bottom-0"
                onClick={(e) => e.stopPropagation()}
              >
                <OracleHistory collapsed={false} onToggle={() => setHistoryCollapsed(true)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Chat column ── */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Scrollable message area */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="min-h-0 flex-1 overflow-y-auto custom-scrollbar"
          >
            {hasMessages ? (
              <div className="mx-auto w-full max-w-[800px] px-4 py-6 sm:px-6">
                <div className="space-y-7">
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
              <div className="mx-auto w-full max-w-[800px] px-4 py-6 sm:px-6">
                <OracleWelcome onPickSuggestion={handlePickSuggestion} />
              </div>
            )}
          </div>

          {/* ── Sticky input area ── */}
          <div className="shrink-0 border-t border-white/[0.06] bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-4 pt-3 sm:px-6">
            <div className="mx-auto w-full max-w-[800px]">
              <OracleInput
                ref={inputRef}
                onSend={handleSend}
                onStop={handleStop}
                isStreaming={isStreaming}
              />
              <p className="mt-2 text-center text-[10.5px] text-muted-foreground/60">
                Oracle is a GST · CFO · Compliance assistant. Always verify critical
                tax decisions with a qualified professional.
              </p>
            </div>
          </div>
        </main>
      </div>

      {/* ── Business Memory™ slide-in panel ── */}
      <MemoryPanel
        open={memoryOpen}
        onClose={() => setMemoryOpen(false)}
        userEmail={user?.email}
      />

      {/* ── Real Data Connectors™ slide-in panel ── */}
      <ConnectorsPanel
        open={connectorsOpen}
        onClose={() => setConnectorsOpen(false)}
      />

      {/* ── Business Graph™ full-screen overlay ── */}
      <BusinessGraphPanel
        open={graphOpen}
        onClose={() => setGraphOpen(false)}
        onOpenConnectors={() => { setGraphOpen(false); setConnectorsOpen(true); }}
      />
    </div>
  );
}

export default OracleChat;
