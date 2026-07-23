'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Full-Screen AI CFO Experience (Production v2)
//
// Premium ChatGPT-Enterprise-grade AI CFO:
//   • Full-screen welcome with "Oracle AI CFO / Your Financial Brain" hero
//   • Thinking animation with step-by-step checklist before streaming
//   • Streaming markdown responses with copy/regenerate
//   • Conversation history sidebar (rename/delete/new chat)
//   • Auto-growing textarea, sticky input bar
//   • Mobile responsive
//   • HTTP 400 NEVER visible — friendly retries with backoff
//
// Standardized request schema (ALWAYS sent to backend):
//   {
//     messages: [{ role: 'user' | 'oracle', content: '...' }],
//     memory?: { userName, userId, firmName, gstin },
//     context?: { organizationId }
//   }
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, Plus, MessageSquare, Trash2, X, Sparkles, BadgeCheck,
  Copy, Check, RefreshCw, Pencil, ArrowLeft, Brain,
} from 'lucide-react';
import { useOracleConversations } from '@/lib/oracle-conversations';
import { OracleInput, type OracleInputHandle } from './OracleInput';
import { OracleWelcomeScreen } from './OracleWelcomeScreen';
import { OracleThinkingAnimation } from './OracleThinkingAnimation';

// ─── Markdown renderer (lightweight, no heavy deps) ──────────────────────────
// Renders **bold**, *italic*, `code`, # headings, - lists, | tables |, and
// paragraphs. Sufficient for AI CFO responses without a 50KB markdown lib.

function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) { i++; continue; }

    // Headings
    if (line.startsWith('### ')) {
      blocks.push(<h4 key={key++} className="mt-3 mb-1.5 text-[14px] font-semibold text-white">{inline(line.slice(4))}</h4>);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(<h3 key={key++} className="mt-4 mb-2 text-[15px] font-semibold text-white">{inline(line.slice(3))}</h3>);
      i++; continue;
    }
    if (line.startsWith('# ')) {
      blocks.push(<h2 key={key++} className="mt-4 mb-2 text-[16px] font-bold text-white">{inline(line.slice(2))}</h2>);
      i++; continue;
    }

    // Table (lines starting with |)
    if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().startsWith('|') && lines[i + 1].includes('---')) {
      const headerCells = line.trim().split('|').slice(1, -1).map(c => c.trim());
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].trim().split('|').slice(1, -1).map(c => c.trim()));
        i++;
      }
      blocks.push(
        <div key={key++} className="my-2 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-[13px]">
            <thead className="bg-white/[0.04]">
              <tr>{headerCells.map((c, ci) => <th key={ci} className="px-3 py-2 text-left font-medium text-white/80">{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-t border-white/5">
                  {r.map((c, ci) => <td key={ci} className="px-3 py-2 text-white/70">{inline(c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Bullet list
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-1.5 space-y-1">
          {items.map((it, ii) => (
            <li key={ii} className="flex gap-2 text-[14px] text-white/85">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
              <span>{inline(it)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ''));
        i++;
      }
      blocks.push(
        <ol key={key++} className="my-1.5 space-y-1">
          {items.map((it, ii) => (
            <li key={ii} className="flex gap-2 text-[14px] text-white/85">
              <span className="font-semibold text-amber-400">{ii + 1}.</span>
              <span>{inline(it)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph
    blocks.push(<p key={key++} className="text-[14px] leading-relaxed text-white/85">{inline(line)}</p>);
    i++;
  }

  return <>{blocks}</>;
}

function inline(text: string): React.ReactNode {
  // **bold**, *italic*, `code`
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    // bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const codeMatch = remaining.match(/`(.+?)`/);
    const italicMatch = remaining.match(/\*(.+?)\*/);

    const matches = [
      boldMatch ? { type: 'bold', match: boldMatch, idx: boldMatch.index! } : null,
      codeMatch ? { type: 'code', match: codeMatch, idx: codeMatch.index! } : null,
      italicMatch ? { type: 'italic', match: italicMatch, idx: italicMatch.index! } : null,
    ].filter(Boolean).sort((a, b) => a!.idx - b!.idx) as { type: string; match: RegExpMatchArray; idx: number }[];

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const m = matches[0];
    if (m.idx > 0) parts.push(remaining.slice(0, m.idx));
    if (m.type === 'bold') parts.push(<strong key={key++} className="font-semibold text-white">{m.match[1]}</strong>);
    if (m.type === 'code') parts.push(<code key={key++} className="rounded bg-white/10 px-1 py-0.5 text-[12px] font-mono text-amber-300">{m.match[1]}</code>);
    if (m.type === 'italic') parts.push(<em key={key++} className="italic text-white/70">{m.match[1]}</em>);
    remaining = remaining.slice(m.idx + m.match[0].length);
  }
  return <>{parts}</>;
}

// ─── Message bubble ──────────────────────────────────────────────────────────

interface MessageTurn {
  id: string;
  role: 'user' | 'oracle';
  content: string;
  streaming?: boolean;
  error?: boolean;
  followUps?: string[];
  createdAt: string;
}

function MessageBubble({
  turn,
  onPickFollowUp,
  onRetry,
  onCopy,
  copiedId,
  isLast,
}: {
  turn: MessageTurn;
  onPickFollowUp?: (p: string) => void;
  onRetry?: () => void;
  onCopy?: (id: string) => void;
  copiedId?: string | null;
  isLast: boolean;
}) {
  const isUser = turn.role === 'user';
  const time = new Date(turn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div className="max-w-[80%] sm:max-w-[70%]">
          <div className="rounded-3xl rounded-br-md bg-amber-500/10 px-4 py-3 ring-1 ring-amber-500/20">
            <p className="text-[14px] leading-relaxed text-white whitespace-pre-wrap">{turn.content}</p>
          </div>
          <p className="mt-1 text-right text-[10px] text-white/30">{time}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      {/* Gold avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_12px_-2px_rgba(245,158,11,0.4)]">
        <Sparkles className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-[12px] font-semibold text-white">Oracle</span>
          <BadgeCheck className="h-3 w-3 text-amber-500" />
          <span className="text-[10px] text-white/30">{time}</span>
        </div>
        <div className={`rounded-3xl rounded-bl-md border px-4 py-3 ${turn.error ? 'border-red-500/20 bg-red-500/5' : 'border-[#1F1F1F] bg-[#111111]'}`}>
          {turn.error ? (
            <div className="flex items-center gap-2">
              <p className="text-[13px] text-red-400">{turn.content}</p>
              {onRetry && (
                <button onClick={onRetry} className="ml-auto flex items-center gap-1 rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-400 ring-1 ring-amber-500/20 hover:bg-amber-500/20">
                  <RefreshCw className="h-3 w-3" /> Try again
                </button>
              )}
            </div>
          ) : (
            <div className="text-[14px] leading-relaxed text-white/90">
              {renderMarkdown(turn.content)}
              {turn.streaming && (
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="ml-0.5 inline-block h-4 w-1.5 rounded-sm bg-amber-400 align-middle"
                />
              )}
            </div>
          )}
        </div>

        {/* Action row: copy / regenerate (only on last oracle msg, not streaming) */}
        {!turn.streaming && !turn.error && isLast && (
          <div className="mt-2 flex items-center gap-1">
            <button
              onClick={() => onCopy?.(turn.id)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
            >
              {copiedId === turn.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copiedId === turn.id ? 'Copied' : 'Copy'}
            </button>
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
              >
                <RefreshCw className="h-3 w-3" /> Regenerate
              </button>
            )}
          </div>
        )}

        {/* Follow-up chips */}
        {turn.followUps && turn.followUps.length > 0 && !turn.streaming && (
          <div className="mt-2 flex flex-wrap gap-2">
            {turn.followUps.map((f, i) => (
              <button
                key={i}
                onClick={() => onPickFollowUp?.(f)}
                className="rounded-full border border-[#1F1F1F] bg-[#111111] px-3 py-1.5 text-[12px] text-white/60 transition-colors hover:border-amber-500/30 hover:text-amber-300"
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

// ─── Session reader ──────────────────────────────────────────────────────────

interface SessionUser { id?: string; name?: string; email?: string; picture?: string }
const SESSION_KEY = 'gstpilot_session';

function readSessionUser(): SessionUser {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return { id: parsed.id, name: parsed.name, email: parsed.email, picture: parsed.picture };
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

// ─── Stream Oracle — robust fetch with retry, NEVER exposes HTTP 400 ─────────

interface StreamEvent {
  token?: string;
  done?: boolean;
  error?: string;
  language?: string;
}

const MAX_RETRIES = 3;
const FRIENDLY_ERROR = "I'm having trouble connecting right now. Please try again in a moment.";

async function fetchWithRetry(payload: unknown, signal?: AbortSignal): Promise<Response> {
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

      // 401/403 — auth errors, don't retry
      if (res.status === 401 || res.status === 403) {
        throw new Error('Authentication required. Please sign in again.');
      }

      // 400/500 — retry with backoff (NEVER expose "messages[] required" to user)
      lastError = new Error(`HTTP ${res.status}`);

      if (attempt < MAX_RETRIES - 1) {
        const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      lastError = err instanceof Error ? err : new Error('Network error');

      if (attempt < MAX_RETRIES - 1) {
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
    }
  }

  throw new Error(FRIENDLY_ERROR);
}

async function streamOracle(
  payload: {
    message: string;
    history: { role: 'user' | 'assistant'; content: string }[];
    userName?: string;
    userId?: string;
  },
  handlers: {
    onDelta: (delta: string) => void;
    onDone: () => void;
    onError: (message: string) => void;
  },
  signal?: AbortSignal
): Promise<void> {
  try {
    // ── Build the STANDARDIZED request schema ──
    // Every request MUST be: { messages: [{role, content}] }
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
    // NEVER expose raw HTTP 400 — always friendly
    const msg = err instanceof Error ? err.message : 'Network error';
    handlers.onError(msg.includes('HTTP 4') || msg.includes('messages[]') ? FRIENDLY_ERROR : msg);
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function OracleChat() {
  const user = useSessionUser();

  const conversations = useOracleConversations((s) => s.conversations);
  const activeId = useOracleConversations((s) => s.activeId);
  const getActive = useOracleConversations((s) => s.getActive);
  const createConversation = useOracleConversations((s) => s.createConversation);
  const renameConversation = useOracleConversations((s) => s.renameConversation);
  const deleteConversation = useOracleConversations((s) => s.deleteConversation);
  const setActive = useOracleConversations((s) => s.setActive);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [backHref] = useState('/');

  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<OracleInputHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const isStreamingRef = useRef(false);
  const activeRef = useRef(getActive());

  const active = getActive();
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);

  const messages = active?.messages ?? [];
  const hasMessages = messages.length > 0;

  // ── Auto-scroll ──
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

  // ── Build history payload (exclude the empty oracle placeholder) ──
  const buildHistoryPayload = useCallback((excludeOracleTurnId: string) => {
    const current = activeRef.current;
    if (!current) return [];
    return current.messages
      .filter((m) => m.id !== excludeOracleTurnId && !m.streaming && !m.error && m.content.trim())
      .map((m) => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }));
  }, []);

  // ── Send a message ──
  const handleSend = useCallback(async (message: string) => {
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

    // Show thinking animation for 1.5s before stream starts
    await new Promise((r) => setTimeout(r, 1500));
    if (controller.signal.aborted) return;
    setShowThinking(false);

    await streamOracle(
      { message, history, userName: user?.name, userId: user?.id },
      {
        onDelta: (delta) => store.appendDelta(oracleTurnId, delta),
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
  }, [buildHistoryPayload, user]);

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

  const handleCopy = (id: string) => {
    const turn = messages.find((m) => m.id === id);
    if (!turn) return;
    navigator.clipboard.writeText(turn.content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {});
  };

  const handleNewChat = () => {
    createConversation();
    setSidebarOpen(false);
  };

  const handleStartRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const handleSaveRename = () => {
    if (editingId && editTitle.trim()) {
      renameConversation(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleDelete = (id: string) => {
    deleteConversation(id);
  };

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#070707] text-white">
      {/* ── Top bar ── */}
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-[#1F1F1F] bg-[#070707]/80 px-3 backdrop-blur-xl md:px-5">
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
          aria-label="Conversation history"
        >
          <Menu className="h-4 w-4" />
        </button>

        <a
          href={backHref}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
          aria-label="Back to home"
        >
          <ArrowLeft className="h-4 w-4" />
        </a>

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
          <a
            href={backHref}
            className="hidden items-center gap-1.5 rounded-lg border border-[#1F1F1F] bg-[#0E0E0E] px-3 py-1.5 text-[12px] font-medium text-white/70 transition-colors hover:border-amber-500/30 hover:text-amber-300 sm:flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </a>
          <button
            onClick={handleNewChat}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
            aria-label="New conversation"
          >
            <Plus className="h-4 w-4" />
          </button>
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
                      <MessageBubble
                        turn={turn}
                        onPickFollowUp={handlePickSuggestion}
                        onRetry={turn.role === 'oracle' && idx === messages.length - 1 ? handleRetry : undefined}
                        onCopy={handleCopy}
                        copiedId={copiedId}
                        isLast={idx === messages.length - 1}
                      />
                      {/* Thinking animation after the latest user message while streaming */}
                      {turn.role === 'user' && idx === messages.length - 1 && showThinking && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-6 flex gap-3"
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

      {/* ── History sidebar drawer ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40"
            onClick={() => setSidebarOpen(false)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute left-0 top-0 flex h-full w-80 max-w-[85vw] flex-col border-r border-[#1F1F1F] bg-[#0A0A0A] p-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Brain className="h-4 w-4 text-amber-400" />
                  Conversations
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-lg p-1 text-white/50 hover:bg-white/5 hover:text-white"
                  aria-label="Close sidebar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={handleNewChat}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-2px_rgba(245,158,11,0.4)] transition-all hover:brightness-110"
              >
                <Plus className="h-4 w-4" />
                New Conversation
              </button>
              <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-white/40">No conversations yet</p>
                ) : (
                  conversations.map((c) => (
                    <div
                      key={c.id}
                      className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                        c.id === activeId
                          ? 'bg-white/[0.06] text-white ring-1 ring-inset ring-white/10'
                          : 'text-white/60 hover:bg-white/[0.03] hover:text-white'
                      }`}
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      {editingId === c.id ? (
                        <input
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={handleSaveRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename();
                            if (e.key === 'Escape') { setEditingId(null); setEditTitle(''); }
                          }}
                          className="min-w-0 flex-1 rounded border border-amber-500/30 bg-[#070707] px-1.5 py-0.5 text-sm text-white outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => { setActive(c.id); setSidebarOpen(false); }}
                          className="min-w-0 flex-1 truncate text-left"
                        >
                          {c.title || 'New conversation'}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStartRename(c.id, c.title); }}
                        className="shrink-0 text-white/40 opacity-0 transition group-hover:opacity-100 hover:text-amber-300"
                        aria-label="Rename"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                        className="shrink-0 text-white/40 opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default OracleChat;
