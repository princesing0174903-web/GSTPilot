'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle — Premium AI Business Operating System (PROMPT 3)
//
// Three-column layout (ChatGPT Enterprise + Claude + Perplexity level):
//   • LEFT  — OracleLeftSidebar (New Chat, Search, Categories, Pinned, Folders)
//   • CENTER — Chat thread + welcome screen + thinking animation + sticky input
//   • RIGHT — OracleRightPanel (LIVE insights, health, deadlines, priorities)
//
// Premium feel: glassmorphism, gold gradient brand, framer-motion micro
// interactions, streaming tokens, thinking checklist, export/like/dislike.
//
// Resilience: HTTP 400 "messages[] is required" is NEVER shown to the user.
// The streamOracle helper retries 400/500 with backoff and falls back to a
// friendly message.
//
// Memory: conversations persist to localStorage via useOracleConversations.
// Oracle never asks the same thing twice — history is passed on every call.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Menu, Bell, LogOut, User as UserIcon, Brain, Plug, Share2,
  Sparkles, BadgeCheck, RefreshCw, Pencil,
  PanelRight,
} from 'lucide-react';
import {
  Avatar, AvatarFallback, AvatarImage,
} from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOracleConversations } from '@/lib/oracle-conversations';
import type { StructuredQueryResult } from '@/lib/oracle/structured-query-types';
import type {
  OracleMetricCard,
  OracleActionButton,
  OracleToolExecution,
  OracleTurn,
  OracleAgentFinding,
  OracleConfidenceTag,
  OracleBusinessScorecard,
  OracleTimelineItem,
  OracleInsight,
  OracleRecommendation,
  OracleSmartFollowUp,
  OracleDashboardUpdate,
} from '@/lib/oracle-conversations';
import { toFriendlyError } from '@/lib/oracle/oracle-recovery';
import { OracleInput, type OracleInputHandle } from './OracleInput';
import { OracleWelcomeScreen } from './OracleWelcomeScreen';
import { OracleThinkingStatus } from './OracleThinkingStatus';
import { OracleActions } from './OracleActions';
import { OracleMarkdown } from './OracleMarkdown';
import { OracleDataCard } from './OracleDataCard';
import { OracleLeftSidebar } from './OracleLeftSidebar';
import { OracleRightPanel } from './OracleRightPanel';
import { OracleBrainPanel } from './OracleBrainPanel';
import { OracleExecutiveHeader } from './OracleExecutiveResponse';
import { OracleMessageActions } from './OracleMessageActions';
import { OracleFollowUps } from './OracleFollowUps';
import { OracleResponseCard } from './OracleResponseCards';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a turn's ISO timestamp as a stable "HH:MM" string. Using the turn's
 *  own createdAt avoids the timestamp-drift bug where `new Date()` was called
 *  on every render, producing a different time each render cycle. */
function formatTurnTime(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// ─── Lightweight inline message renderer (memoized) ──────────────────────────
// Renders user/oracle messages as rounded bubbles with gold avatar, plus a
// premium action row powered by OracleMessageActions: Copy · Regenerate ·
// Continue · Like · Dislike · Share · Export. Follow-ups use OracleFollowUps.

type FeedbackState = 'like' | 'dislike' | undefined;

interface LightOracleMessageProps {
  turn: OracleTurn;
  /** Initial per-turn feedback (from a parent cache). */
  feedback?: FeedbackState;
  onPickFollowUp?: (prompt: string) => void;
  onRetry?: () => void;
  onContinue?: () => void;
  onLike?: (liked: boolean) => void;
  onDislike?: (disliked: boolean) => void;
  onEdit?: () => void;
  /** Disable Regenerate / Continue while another stream is running. */
  busy?: boolean;
  /** The last user prompt — used to generate contextual follow-ups. */
  lastUserPrompt?: string;
}

function LightOracleMessageImpl({
  turn,
  feedback,
  onPickFollowUp,
  onRetry,
  onContinue,
  onLike,
  onDislike,
  onEdit,
  busy = false,
  lastUserPrompt,
}: LightOracleMessageProps) {
  const isUser = turn.role === 'user';
  // Stable timestamp — derived once from the turn's createdAt, never drifts.
  const time = formatTurnTime(turn.createdAt);

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="group flex justify-end"
      >
        <div className="max-w-[80%] rounded-3xl rounded-br-md bg-amber-500/10 px-4 py-3 ring-1 ring-amber-500/20">
          <p className="text-[14px] leading-relaxed text-white whitespace-pre-wrap break-words">{turn.content}</p>
          <div className="mt-1 flex items-center justify-end gap-2">
            {time && <p className="text-[10px] text-white/30">{time}</p>}
            {onEdit && (
              <button
                onClick={onEdit}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white/30 opacity-0 transition-all hover:bg-white/5 hover:text-amber-300 focus:opacity-100 group-hover:opacity-100"
                aria-label="Edit prompt"
                title="Edit prompt"
              >
                <Pencil className="h-3 w-3" />
                <span>Edit</span>
              </button>
            )}
          </div>
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
          {time && <span className="text-[10px] text-white/30">{time}</span>}
        </div>

        {/* Structured data card (table/stats/chart) — rendered ABOVE the text answer */}
        {turn.structured && !turn.error && (
          <OracleDataCard data={turn.structured} />
        )}

        {/* Executive header — tool trace + metrics + scorecard + insights + timeline + recommendations + actions + smart follow-ups */}
        {!turn.error && (
          turn.toolTrace?.length ||
          turn.metrics?.length ||
          turn.scorecard ||
          turn.confidences?.length ||
          turn.timeline?.length ||
          turn.insights?.length ||
          turn.recommendations?.length ||
          turn.actions?.length ||
          turn.smartFollowUps?.length
        ) ? (
          <OracleExecutiveHeader
            tools={turn.toolTrace}
            metrics={turn.metrics}
            intent={turn.intent}
            scorecard={turn.scorecard}
            confidences={turn.confidences}
            timeline={turn.timeline}
            insights={turn.insights}
            recommendations={turn.recommendations}
            followUps={turn.smartFollowUps}
            actions={turn.actions}
            onAction={(p) => onPickFollowUp?.(p)}
            onAsk={(q) => onPickFollowUp?.(q)}
          />
        ) : null}

        <div className={`rounded-3xl rounded-bl-md border px-4 py-3 ${turn.error ? 'border-red-500/20 bg-red-500/5' : 'border-[#1F1F1F] bg-[#111111]'}`}>
          {turn.error ? (
            <div className="flex items-center gap-2">
              <p className="text-[13px] text-red-400">{turn.content}</p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  disabled={busy}
                  className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-amber-400 transition-colors hover:bg-amber-500/10 hover:text-amber-300 disabled:opacity-40"
                  aria-label="Try again"
                >
                  <RefreshCw className="h-3 w-3" /> Try again
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Inline AI response card — detects GST/Revenue/Profit/Vendor/Invoice/Risk patterns */}
              {!turn.streaming && turn.content.length > 0 && (
                <OracleResponseCard text={turn.content} />
              )}
              <OracleMarkdown content={turn.content} streaming={turn.streaming} />
            </>
          )}
        </div>

        {/* ── Premium action row ── */}
        {!turn.error && !turn.streaming && turn.content.length > 0 && (
          <OracleMessageActions
            content={turn.content}
            onRegenerate={onRetry}
            onContinue={onContinue}
            onLike={onLike}
            onDislike={onDislike}
            liked={feedback === 'like'}
            disliked={feedback === 'dislike'}
            disableRegenerate={busy}
            disableContinue={busy}
          />
        )}

        {/* ── Contextual follow-up suggestions ── */}
        {!turn.error && !turn.streaming && turn.content.length > 0 && (
          <OracleFollowUps
            smartFollowUps={turn.smartFollowUps}
            followUps={turn.followUps}
            answerText={turn.content}
            lastUserPrompt={lastUserPrompt}
            onPick={(p) => onPickFollowUp?.(p)}
            disabled={busy}
          />
        )}
      </div>
    </motion.div>
  );
}

const LightOracleMessage = memo(LightOracleMessageImpl);

// ─── Lightweight modal stubs (kept lean to prevent OOM on 4GB sandboxes) ──────
function MemoryPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-2">
          <Brain className="h-5 w-5 text-amber-400" />
          <h3 className="text-base font-semibold text-white">Business Memory</h3>
        </div>
        <p className="text-sm text-white/60">Oracle remembers your business context across conversations — customers, invoices, GST history, and company profile. You never have to repeat yourself.</p>
        <button onClick={onClose} className="mt-4 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20">Close</button>
      </div>
    </div>
  );
}
function ConnectorsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-2">
          <Plug className="h-5 w-5 text-amber-400" />
          <h3 className="text-base font-semibold text-white">Data Connectors</h3>
        </div>
        <p className="text-sm text-white/60">Connect Zoho Books, GSTN, Banking, and Google Workspace to unlock live insights.</p>
        <button onClick={onClose} className="mt-4 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20">Close</button>
      </div>
    </div>
  );
}
function BusinessGraphPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-2">
          <Share2 className="h-5 w-5 text-amber-400" />
          <h3 className="text-base font-semibold text-white">Business Graph</h3>
        </div>
        <p className="text-sm text-white/60">Visualize connections across your business data.</p>
        <button onClick={onClose} className="mt-4 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20">Close</button>
      </div>
    </div>
  );
}

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
  // PROMPT 4 pipeline events
  tools?: { toolId: string; label: string; status: 'running' | 'done' | 'error'; summary: string; recordCount?: number; durationMs?: number }[];
  intent?: string;
  metrics?: { key: string; label: string; value: string; sub?: string; trend?: 'up' | 'down' | 'flat'; tone?: 'positive' | 'negative' | 'neutral' | 'warning' }[];
  actions?: { id: string; label: string; icon: string; prompt: string; tone?: 'primary' | 'default' }[];
  followUps?: string[];
  // PROMPT 5 autonomous CFO events
  agents?: { agent: string; headline: string; analysis: string; severity: 'info' | 'watch' | 'warn' | 'critical'; confidence: number; evidence: string[] }[];
  confidences?: { label: string; confidence: number; rationale: string }[];
  scorecard?: OracleBusinessScorecard | null;
  timeline?: { bucket: 'today' | 'this_week' | 'this_month' | 'upcoming' | 'missed' | 'events'; when: string; title: string; detail?: string; severity?: 'info' | 'watch' | 'warn' | 'critical' }[];
  insights?: { id: string; headline: string; detail: string; tone: 'positive' | 'negative' | 'warning' | 'opportunity'; metric?: string; actionPrompt?: string }[];
  recommendations?: { id: string; title: string; priority: 'P0' | 'P1' | 'P2' | 'P3'; reason: string; impact: string; estimatedOutcome: string; actionPrompt?: string }[];
  // Smart follow-ups as structured objects (PROMPT 5). Legacy string[] followUps
  // is still supported for backward compatibility.
  followUpsObj?: { id: string; question: string; rationale?: string }[];
  dashboard?: OracleDashboardUpdate | null;
}

// ─── streamOracle — with automatic HTTP 400/500 retry ─────────────────────────
//
// CRITICAL: The user must NEVER see "messages[] is required" (HTTP 400).
// On 400/500 errors, we retry up to 3 times with exponential backoff
// (1s → 2s → 4s). If all retries fail, we show a friendly fallback message.
// On 401/403 we attempt ONE silent session-refresh retry, then surface a
// SESSION_EXPIRED signal so the UI can redirect to login gracefully.

const MAX_RETRIES = 3;
const FRIENDLY_ERROR = "I'm having trouble connecting right now. Please try again in a moment.";
const SESSION_EXPIRED_FLAG = '__ORACLE_SESSION_EXPIRED__';

/** Typed sentinel thrown when authentication fails after a refresh attempt. */
class SessionExpiredError extends Error {
  constructor() {
    super(SESSION_EXPIRED_FLAG);
    this.name = 'SessionExpiredError';
  }
}

async function fetchWithRetry(
  payload: unknown,
  signal?: AbortSignal
): Promise<Response> {
  let lastError: Error | null = null;
  let authRetried = false;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    try {
      const res = await fetch('/api/oracle/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });

      if (res.ok) return res;

      const bodyText = await res.text().catch(() => '');
      lastError = new Error(`HTTP ${res.status}: ${bodyText}`);

      if (res.status === 401 || res.status === 403) {
        // Give Firebase a moment to rotate the token, then retry ONCE.
        if (!authRetried) {
          authRetried = true;
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }
        throw new SessionExpiredError();
      }

      if (attempt < MAX_RETRIES - 1) {
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      lastError = err instanceof Error ? err : new Error('Network error');

      if (attempt < MAX_RETRIES - 1) {
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
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
    userEmail?: string;
    userName?: string;
    userId?: string;
  },
  handlers: {
    onDelta: (delta: string) => void;
    onFollowUps: (prompts: string[]) => void;
    onStructured?: (data: StructuredQueryResult) => void;
    onMetrics?: (metrics: StreamEvent['metrics']) => void;
    onActions?: (actions: StreamEvent['actions']) => void;
    onToolTrace?: (tools: StreamEvent['tools'], intent?: string) => void;
    onDone: () => void;
    onError: (message: string) => void;
    onRetry?: (attempt: number) => void;
    /** Fired when the session is definitively expired (401/403 after refresh). */
    onSessionExpired?: () => void;
    // PROMPT 5 autonomous CFO handlers
    onAgentFindings?: (findings: NonNullable<StreamEvent['agents']>) => void;
    onConfidences?: (tags: NonNullable<StreamEvent['confidences']>) => void;
    onScorecard?: (scorecard: OracleBusinessScorecard | null) => void;
    onTimeline?: (items: NonNullable<StreamEvent['timeline']>) => void;
    onInsights?: (insights: NonNullable<StreamEvent['insights']>) => void;
    onRecommendations?: (recs: NonNullable<StreamEvent['recommendations']>) => void;
    onSmartFollowUps?: (followUps: NonNullable<StreamEvent['followUpsObj']>) => void;
    onDashboard?: (dashboard: OracleDashboardUpdate | null) => void;
  },
  signal?: AbortSignal
): Promise<void> {
  try {
    const messages = [
      ...payload.history.map((m) => ({
        role: (m.role === 'user' ? 'user' : 'oracle') as 'user' | 'oracle',
        content: m.content,
      })),
      { role: 'user' as const, content: payload.message },
    ];

    // Resolve the active organization. Prefer the value stored by the workspace
    // shell; fall back to the canonical preview org so Oracle ALWAYS has real
    // data to reason over (matches OracleWorkspace's orgCtx fallback).
    let organizationId: string = 'preview-org';
    try {
      const stored = window.localStorage.getItem('gstpilot_org_id');
      if (stored && stored.trim()) organizationId = stored.trim();
    } catch { /* private mode — keep preview-org */ }

    const apiPayload = {
      messages,
      memory: { userName: payload.userName, userId: payload.userId },
      context: { organizationId },
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
          if (data.structured) handlers.onStructured?.(data.structured as StructuredQueryResult);
          if (data.tools) handlers.onToolTrace?.(data.tools, data.intent);
          if (data.metrics) handlers.onMetrics?.(data.metrics);
          if (data.actions) handlers.onActions?.(data.actions);
          // PROMPT 5: the API emits `followUps` as SmartFollowUp objects
          // ({id, question, rationale}). Legacy `followUps` were string[].
          // Dispatch based on shape to avoid "Objects are not valid as a React
          // child" crashes.
          if (data.followUps) {
            const first = data.followUps[0];
            if (first && typeof first === 'object') {
              handlers.onSmartFollowUps?.(data.followUps as unknown as NonNullable<StreamEvent['followUpsObj']>);
            } else {
              handlers.onFollowUps(data.followUps as unknown as string[]);
            }
          }
          // PROMPT 5: dispatch autonomous CFO events
          if (data.agents) handlers.onAgentFindings?.(data.agents);
          if (data.confidences) handlers.onConfidences?.(data.confidences);
          if (data.scorecard !== undefined) handlers.onScorecard?.(data.scorecard ?? null);
          if (data.timeline) handlers.onTimeline?.(data.timeline);
          if (data.insights) handlers.onInsights?.(data.insights);
          if (data.recommendations) handlers.onRecommendations?.(data.recommendations);
          if (data.followUpsObj) handlers.onSmartFollowUps?.(data.followUpsObj);
          if (data.dashboard !== undefined) handlers.onDashboard?.(data.dashboard ?? null);
          if (data.token) handlers.onDelta(data.token);
          if (data.done) { handlers.onDone(); return; }
          if (data.error) { handlers.onError(FRIENDLY_ERROR); return; }
        } catch { /* skip malformed */ }
      }
    }
    handlers.onDone();
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      handlers.onSessionExpired?.();
      handlers.onError('Your session has expired. Please sign in again to continue.');
      return;
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      handlers.onDone();
      return;
    }
    // Any other failure (network drop, HTTP 5xx after retries, malformed
    // stream) → friendly message. The user NEVER sees a raw "Failed to fetch"
    // or "network error" string.
    handlers.onError(FRIENDLY_ERROR);
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
  const setFeedback = useOracleConversations((s) => s.setFeedback);
  const pendingPrompt = useOracleConversations((s) => s.pendingPrompt);
  const consumePendingPrompt = useOracleConversations((s) => s.consumePendingPrompt);

  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  /** Per-turn feedback cache: turnId → 'like' | 'dislike'. Stored in component
   *  state (not the persisted store) so feedback is per-turn, not per-conversation.
   *  Survives conversation switching because it's keyed by turn id. */
  const [feedbackMap, setFeedbackMap] = useState<Record<string, FeedbackState>>({});

  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<OracleInputHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const isStreamingRef = useRef(false);
  /** Prevents duplicate Send clicks while a request is already in flight. */
  const sendingRef = useRef(false);
  /** Watchdog timer — guarantees a loading state can NEVER hang forever. */
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The oracle turn currently being streamed (used by Stop to finalize it). */
  const streamingTurnIdRef = useRef<string | null>(null);
  /** Tracks whether any output (token/structured) has arrived, to hide the
   *  thinking animation at the right moment instead of a fixed delay. */
  const firstOutputRef = useRef(false);
  /** The user prompt for the stream currently in flight — fed to the thinking
   *  status so the rotating messages adapt to the question's intent. Kept as
   *  state (not a ref) so reading it during render is allowed. */
  const [streamingPrompt, setStreamingPrompt] = useState('');
  /** Debounce handle for smooth auto-scroll during streaming (prevents jank). */
  const scrollRafRef = useRef<number | null>(null);

  const activeRef = useRef<ReturnType<typeof getActive>>(null);
  const active = getActive();

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);

  // ── Hydration cleanup ──
  // Finalize any turn that was still "streaming" when the page was closed or
  // refreshed. Without this, a reload would show an infinite spinner on the
  // last Oracle message. (Fixes "Loading states sometimes never end" + ensures
  // chat history is cleanly preserved after refresh.)
  useEffect(() => {
    try {
      useOracleConversations.getState().finalizeAllStreaming();
    } catch { /* non-fatal */ }
  }, []);

  // ── Cross-page prefill ──
  // When the user clicks "Ask Oracle" on another workspace page (invoices,
  // customers, returns, finance), that page calls setPendingPrompt(prompt) on
  // the oracle-conversations store and navigates to /oracle. We consume that
  // pending prompt here: pull it out of the store (clearing it) and push it
  // into the composer via the input handle. Re-runs whenever `pendingPrompt`
  // changes so it also works if the user is already on /oracle.
  useEffect(() => {
    if (!pendingPrompt) return;
    const consumed = consumePendingPrompt();
    if (!consumed) return;
    // Defer to the next frame so the OracleInput is mounted (it lives later in
    // the JSX tree) and setValue can target the textarea ref.
    const raf = requestAnimationFrame(() => {
      try { inputRef.current?.setValue(consumed); } catch { /* non-fatal */ }
    });
    return () => cancelAnimationFrame(raf);
  }, [pendingPrompt, consumePendingPrompt]);

  // ── Unmount cleanup ──
  // If the user navigates away from /oracle mid-stream, abort the in-flight
  // request and clear the 90s safety watchdog. Without this, the fetch keeps
  // running in the background and may try to update state on an unmounted
  // component (React warning + potential memory pressure on long sessions).
  useEffect(() => {
    return () => {
      try { abortRef.current?.abort(); } catch { /* non-fatal */ }
      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = null;
      }
    };
  }, []);

  const messages = active?.messages ?? [];
  const hasMessages = messages.length > 0;

  // ── Smooth auto-scroll (debounced via requestAnimationFrame) ──
  // During streaming, tokens arrive rapidly. Calling scrollTo on every token
  // causes jank. We coalesce to one rAF per frame for buttery 60 FPS scrolling.
  const scrollToBottom = useCallback(() => {
    if (scrollRafRef.current !== null) return; // already scheduled
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = scrollRef.current;
      if (!el || !shouldAutoScrollRef.current) return;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    scrollToBottom();
  }, [messages, showThinking, scrollToBottom]);

  // Cancel any pending scroll rAF on unmount
  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, []);

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

  /** Build history for Regenerate — excludes the last user message (which
   *  streamOracle appends itself) so the prompt isn't duplicated. Reads the
   *  FRESH store state because the stale activeRef still holds the old turn. */
  function buildHistoryExcludingLastUser(excludeOracleTurnId: string) {
    const current = useOracleConversations.getState().getActive();
    if (!current) return [];
    const msgs = current.messages;
    let lastUserIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') { lastUserIdx = i; break; }
    }
    if (lastUserIdx === -1) return [];
    return msgs
      .slice(0, lastUserIdx)
      .filter((m) => m.id !== excludeOracleTurnId && !m.streaming && !m.error)
      .map((m) => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }));
  }

  // ── Session recovery ──
  // Fired only when the API returns 401/403 AFTER a silent refresh retry. We
  // clear the cached session and redirect to the landing/login page with a
  // clear reason. The user is never left on a broken screen.
  const handleSessionExpired = useCallback(() => {
    toast.error('Your session has expired. Redirecting to sign in…');
    try { localStorage.removeItem(SESSION_KEY); } catch { /* non-fatal */ }
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.href = '/?reason=session_expired';
      }
    }, 1500);
  }, []);

  const STREAM_SAFETY_TIMEOUT_MS = 90_000;

  function clearSafetyTimer() {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }

  /** Idempotent cleanup used by onDone/onError/timeout/finally. Guarantees no
   *  loading flag or timer is left active. */
  function finishStream(oracleTurnId: string) {
    clearSafetyTimer();
    const store = useOracleConversations.getState();
    store.finalizeMessage(oracleTurnId);
    setIsStreaming(false);
    isStreamingRef.current = false;
    sendingRef.current = false;
    setShowThinking(false);
    abortRef.current = null;
    streamingTurnIdRef.current = null;
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  /** Core streaming routine shared by Send + Regenerate + Continue. Sets up
   *  the abort controller, a 90s safety watchdog, the thinking status, and
   *  wires every SSE handler. Never throws — every path calls finishStream. */
  async function runStream(
    oracleTurnId: string,
    message: string,
    history: { role: 'user' | 'assistant'; content: string }[]
  ) {
    const store = useOracleConversations.getState();
    firstOutputRef.current = false;
    shouldAutoScrollRef.current = true;
    setStreamingPrompt(message); // feeds the rotating thinking status
    setShowThinking(true);
    setIsStreaming(true);
    isStreamingRef.current = true;
    streamingTurnIdRef.current = oracleTurnId;

    const controller = new AbortController();
    abortRef.current = controller;

    // Watchdog — NEVER let a loading state hang forever. If the upstream LLM
    // stalls or the network drops mid-stream, we abort + show a clear error.
    clearSafetyTimer();
    safetyTimerRef.current = setTimeout(() => {
      if (streamingTurnIdRef.current !== oracleTurnId) return; // already finished
      try { controller.abort(); } catch { /* non-fatal */ }
      const friendly = toFriendlyError(new Error('timed out'));
      store.setError(oracleTurnId, friendly.message);
      toast.error(friendly.message);
      finishStream(oracleTurnId);
    }, STREAM_SAFETY_TIMEOUT_MS);

    const markFirstOutput = () => {
      if (!firstOutputRef.current) {
        firstOutputRef.current = true;
        setShowThinking(false);
      }
    };

    try {
      await streamOracle(
        { message, history, userEmail: user?.email, userName: user?.name, userId: user?.id },
        {
          onDelta: (delta) => { markFirstOutput(); store.appendDelta(oracleTurnId, delta); },
          onFollowUps: (prompts) => store.setFollowUps(oracleTurnId, prompts),
          onStructured: (data) => { markFirstOutput(); store.setStructured(oracleTurnId, data); },
          onToolTrace: (tools, intent) => { markFirstOutput(); store.setToolTrace(oracleTurnId, tools ?? [], intent); },
          onMetrics: (metrics) => { markFirstOutput(); store.setMetrics(oracleTurnId, metrics ?? []); },
          onActions: (actions) => store.setActions(oracleTurnId, actions ?? []),
          // PROMPT 5: wire autonomous CFO handlers
          onAgentFindings: (findings) => store.setAgentFindings(oracleTurnId, findings as OracleAgentFinding[]),
          onConfidences: (tags) => store.setConfidences(oracleTurnId, tags as OracleConfidenceTag[]),
          onScorecard: (scorecard) => store.setScorecard(oracleTurnId, scorecard as OracleBusinessScorecard | null),
          onTimeline: (items) => store.setTimeline(oracleTurnId, items as OracleTimelineItem[]),
          onInsights: (insights) => store.setInsights(oracleTurnId, insights as OracleInsight[]),
          onRecommendations: (recs) => store.setRecommendations(oracleTurnId, recs as OracleRecommendation[]),
          onSmartFollowUps: (followUps) => store.setSmartFollowUps(oracleTurnId, followUps as OracleSmartFollowUp[]),
          onDashboard: (dashboard) => {
            store.setDashboard(oracleTurnId, dashboard as OracleDashboardUpdate | null);
            // PROMPT 5 §12: Live Dashboard Integration — broadcast the dashboard
            // update so the right-side Insights panel refreshes instantly without
            // a page reload.
            if (dashboard) {
              try {
                window.dispatchEvent(new CustomEvent('oracle:dashboard-update', { detail: dashboard }));
              } catch { /* SSR / non-browser */ }
            }
          },
          onDone: () => finishStream(oracleTurnId),
          onError: (errorMessage) => {
            // Map to a friendly message — never expose raw errors to the user.
            const friendly = toFriendlyError(errorMessage);
            store.setError(oracleTurnId, friendly.message);
            // The session-expired path already shows its own toast + redirect.
            if (!errorMessage.toLowerCase().includes('session has expired')) {
              toast.error(friendly.message);
            }
            finishStream(oracleTurnId);
          },
          onSessionExpired: handleSessionExpired,
        },
        controller.signal
      );
    } catch (err) {
      // streamOracle is expected to handle all errors internally, but guard
      // against any unexpected throw so we never leave a loading state active.
      const friendly = toFriendlyError(err);
      store.setError(oracleTurnId, friendly.message);
      toast.error(friendly.message);
      finishStream(oracleTurnId);
    }
  }

  // ── Send a message ──
  const handleSend = async (message: string) => {
    if (sendingRef.current || isStreamingRef.current) return;
    const trimmed = (message || '').trim();
    if (!trimmed) return;
    sendingRef.current = true;

    const store = useOracleConversations.getState();
    let convId = store.activeId;
    if (!convId) convId = store.createConversation();
    const { oracleTurnId } = store.pushUserMessage(trimmed);
    store.ensureTitle(convId, trimmed);
    const history = buildHistoryPayload(oracleTurnId);

    await runStream(oracleTurnId, trimmed, history);
  };

  // ── Stop generation ──
  // Aborts the in-flight request AND finalizes the current Oracle turn so the
  // partial response is kept (or a neutral placeholder if empty). No infinite
  // spinner is ever left behind.
  const handleStop = () => {
    try { abortRef.current?.abort(); } catch { /* non-fatal */ }
    const turnId = streamingTurnIdRef.current;
    if (turnId) {
      useOracleConversations.getState().markStopped(turnId);
    }
    clearSafetyTimer();
    setIsStreaming(false);
    isStreamingRef.current = false;
    sendingRef.current = false;
    setShowThinking(false);
    abortRef.current = null;
    streamingTurnIdRef.current = null;
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handlePickSuggestion = (prompt: string) => {
    if (sendingRef.current || isStreamingRef.current) return;
    // Continue in the current conversation — do NOT wipe it. The previous
    // behavior created a new conversation on every suggestion click, which
    // discarded the active thread and lost context. `handleSend` creates a
    // conversation automatically if none exists (welcome-screen case).
    requestAnimationFrame(() => handleSend(prompt));
  };

  // ── Regenerate ──
  // Resends the LAST user prompt WITHOUT duplicating it. The old Oracle answer
  // is removed and a fresh streaming turn takes its place. (Fixes the old
  // Regenerate button which either did nothing or added a duplicate user msg.)
  const handleRetry = () => {
    if (sendingRef.current || isStreamingRef.current) return;
    const store = useOracleConversations.getState();
    const regen = store.regenerateLastOracleTurn();
    if (!regen) return;
    sendingRef.current = true;
    const history = buildHistoryExcludingLastUser(regen.oracleTurnId);
    void runStream(regen.oracleTurnId, regen.userMessage, history);
  };

  // ── Continue response ──
  // Asks Oracle to keep writing where it left off. Sends a short "continue"
  // prompt with the full conversation history (including the last Oracle turn)
  // so the model picks up naturally. Appends a new user + oracle turn pair.
  const handleContinue = (oracleTurnId: string) => {
    if (sendingRef.current || isStreamingRef.current) return;
    const store = useOracleConversations.getState();
    const current = store.getActive();
    if (!current) return;
    // Find the oracle turn we're continuing from
    const idx = current.messages.findIndex((m) => m.id === oracleTurnId);
    if (idx === -1) return;
    const oracleTurn = current.messages[idx];
    if (!oracleTurn || oracleTurn.role !== 'oracle' || oracleTurn.error) return;
    // Build history up to and including this oracle turn (so the model sees
    // its own previous answer and continues from there).
    const history = current.messages
      .slice(0, idx + 1)
      .filter((m) => !m.streaming && !m.error)
      .map((m) => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }));
    sendingRef.current = true;
    const { oracleTurnId: newTurnId } = store.pushUserMessage(
      'Please continue your previous response from where you left off.'
    );
    void runStream(newTurnId, 'Please continue your previous response from where you left off.', history);
  };

  // ── Per-turn feedback (Like / Dislike) ──
  // Stored in component state keyed by turn id so it's per-turn (the old store
  // model was per-conversation, which meant liking one answer "liked" the whole
  // thread). We also mirror to the store's conversation-level feedback for
  // backward compatibility with the sidebar.
  const handleLike = useCallback((turnId: string, liked: boolean) => {
    setFeedbackMap((prev) => ({
      ...prev,
      [turnId]: liked ? 'like' : undefined,
    }));
    if (activeId && liked) setFeedback(activeId, 'like');
  }, [activeId, setFeedback]);

  const handleDislike = useCallback((turnId: string, disliked: boolean) => {
    setFeedbackMap((prev) => ({
      ...prev,
      [turnId]: disliked ? 'dislike' : undefined,
    }));
    if (activeId && disliked) setFeedback(activeId, 'dislike');
  }, [activeId, setFeedback]);

  // ── File upload ──
  // Uploads the file to /api/oracle/documents (multipart), then sends a chat
  // prompt that includes the extracted summary so Oracle grounds its answer in
  // the document. Shows toast progress + error states.
  const handleFileUpload = async (file: File) => {
    if (isUploading || sendingRef.current || isStreamingRef.current) {
      toast.error('Please wait for the current action to finish.');
      return;
    }
    setIsUploading(true);
    const toastId = toast.loading(`Uploading "${file.name}"…`);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/oracle/documents', { method: 'POST', body: form });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        document?: { fileName?: string; summary?: string };
      };
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Upload failed. Please try a different file.');
      }
      const doc = data.document;
      toast.success(`"${doc?.fileName || file.name}" uploaded. Analyzing…`, { id: toastId });
      const prompt = doc?.summary
        ? `I uploaded "${doc.fileName}". Here is what was extracted from it:\n\n${doc.summary}\n\nPlease analyze this document and give me the key insights.`
        : `I uploaded "${doc?.fileName || file.name}". Please analyze this document.`;
      // Small delay so the success toast can render before the stream begins.
      setTimeout(() => handleSend(prompt), 300);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      toast.error(msg, { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  // ── Edit previous prompt ──
  // Truncates the conversation back to BEFORE the clicked user turn (removing
  // it and everything after), then prefills the input with the old content so
  // the user can edit and re-send. When they send, it appends as a fresh
  // message — no duplicate turns, no orphaned answers.
  const handleEditPrompt = (turnId: string) => {
    if (sendingRef.current || isStreamingRef.current) {
      toast.message('Please wait for the current response to finish before editing.');
      return;
    }
    const store = useOracleConversations.getState();
    const oldContent = store.truncateFromTurn(turnId);
    if (oldContent) {
      inputRef.current?.setValue(oldContent);
    }
  };

  const userInitials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'G';

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#070707] text-white">
      {/* ── Top bar ── */}
      <header className="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-[#1F1F1F] bg-[#070707]/80 px-3 backdrop-blur-xl md:px-5">
        {/* Mobile: open left sidebar */}
        <button
          onClick={() => setLeftOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white lg:hidden"
          aria-label="Open conversations"
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
              <span className="hidden rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-500 sm:inline">
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
            title="Business Graph"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setConnectorsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
            aria-label="Data Connectors"
            title="Connectors"
          >
            <Plug className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMemoryOpen(true)}
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white sm:flex"
            aria-label="Business Memory"
            title="Memory"
          >
            <Brain className="h-4 w-4" />
          </button>
          {/* Mobile: toggle right panel */}
          <button
            onClick={() => setRightOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white xl:hidden"
            aria-label="Open insights"
            title="Insights"
          >
            <PanelRight className="h-4 w-4" />
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

      {/* ── Body: 3-column layout ── */}
      <div className="relative z-10 flex min-h-0 flex-1">
        {/* LEFT — persistent on lg+, drawer on mobile */}
        <OracleLeftSidebar
          open={leftOpen}
          onClose={() => setLeftOpen(false)}
          onNavigate={() => setLeftOpen(false)}
        />

        {/* CENTER — chat area */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="custom-scrollbar min-h-0 flex-1 overflow-y-auto"
            role="log"
            aria-live="polite"
            aria-label="Oracle conversation"
          >
            {hasMessages ? (
              <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
                <div className="space-y-6">
                  {messages.map((turn, idx) => {
                    // Find the most recent user message at or before this turn —
                    // used to generate contextual follow-up suggestions.
                    let lastUserPrompt: string | undefined;
                    for (let i = idx; i >= 0; i--) {
                      if (messages[i].role === 'user') {
                        lastUserPrompt = messages[i].content;
                        break;
                      }
                    }
                    const isLastOracle = turn.role === 'oracle' && turn.id === messages[messages.length - 1]?.id;
                    return (
                      <div key={turn.id}>
                        <LightOracleMessage
                          turn={turn}
                          feedback={feedbackMap[turn.id]}
                          lastUserPrompt={lastUserPrompt}
                          onPickFollowUp={handlePickSuggestion}
                          onRetry={isLastOracle ? handleRetry : undefined}
                          onContinue={turn.role === 'oracle' && !turn.error && !turn.streaming ? () => handleContinue(turn.id) : undefined}
                          onLike={(liked) => handleLike(turn.id, liked)}
                          onDislike={(disliked) => handleDislike(turn.id, disliked)}
                          onEdit={turn.role === 'user' ? () => handleEditPrompt(turn.id) : undefined}
                          busy={isStreaming}
                        />
                        {/* Show Oracle Actions after the last Oracle message when not streaming */}
                        {turn.role === 'oracle' && !turn.streaming && !turn.error &&
                          idx === messages.length - 1 && !isStreaming && (
                          <OracleActions onAction={handlePickSuggestion} />
                        )}
                        {/* Thinking status appears after the latest user message while streaming.
                            Uses the contextual rotating status (Reading files / Analyzing invoices /
                            Searching memory / Building response / Finalizing answer…) adapted to
                            the user's prompt. */}
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
                              <OracleThinkingStatus prompt={streamingPrompt} compact />
                            </div>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
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
                onFileUpload={handleFileUpload}
                isUploading={isUploading}
              />
              <p className="mt-2 text-center text-[10.5px] text-white/35">
                Oracle is your AI CFO · Uses live data from your connected accounts · Always verify critical tax decisions
              </p>
            </div>
          </div>
        </main>

        {/* RIGHT — persistent on xl+, drawer on mobile/tablet */}
        <aside className="hidden w-80 shrink-0 border-l border-[#1F1F1F] xl:block">
          <OracleRightPanel userName={user?.name} onSuggestion={handlePickSuggestion} />
        </aside>

        {/* Mobile/tablet right panel drawer */}
        <AnimatePresence>
          {rightOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 xl:hidden"
              onClick={() => setRightOpen(false)}
            >
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
              <motion.aside
                initial={{ x: 320 }}
                animate={{ x: 0 }}
                exit={{ x: 320 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="absolute right-0 top-0 h-full w-80 border-l border-[#1F1F1F]"
                onClick={(e) => e.stopPropagation()}
              >
                <OracleRightPanel
                  userName={user?.name}
                  onSuggestion={(p) => { handlePickSuggestion(p); setRightOpen(false); }}
                />
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Slide-in panels ── */}
      <OracleBrainPanel open={memoryOpen} onClose={() => setMemoryOpen(false)} onSuggestion={handlePickSuggestion} />
      <ConnectorsPanel open={connectorsOpen} onClose={() => setConnectorsOpen(false)} />
      <BusinessGraphPanel open={graphOpen} onClose={() => setGraphOpen(false)} />
    </div>
  );
}

export default OracleChat;
