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

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, Bell, LogOut, User as UserIcon, Brain, Plug, Share2,
  Plus, Sparkles, BadgeCheck,
  Copy, Check, RefreshCw, ThumbsUp, ThumbsDown,
  PanelRight, X, Download, FileText, FileSpreadsheet, Pencil,
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
import { OracleInput, type OracleInputHandle } from './OracleInput';
import { OracleWelcomeScreen } from './OracleWelcomeScreen';
import { OracleThinkingAnimation } from './OracleThinkingAnimation';
import { OracleActions } from './OracleActions';
import { OracleMarkdown } from './OracleMarkdown';
import { OracleDataCard } from './OracleDataCard';
import { OracleLeftSidebar } from './OracleLeftSidebar';
import { OracleRightPanel } from './OracleRightPanel';
import { OracleExecutiveHeader } from './OracleExecutiveResponse';

// ─── Lightweight inline message renderer ─────────────────────────────────────
// Renders user/oracle messages as rounded bubbles with gold avatar, plus a
// premium action row: Copy · Regenerate · Like · Dislike · Edit · Export.

function LightOracleMessage({
  turn,
  onPickFollowUp,
  onRetry,
  onLike,
  onDislike,
  onEdit,
}: {
  turn: OracleTurn;
  onPickFollowUp?: (prompt: string) => void;
  onRetry?: () => void;
  onLike?: () => void;
  onDislike?: () => void;
  onEdit?: () => void;
}) {
  const isUser = turn.role === 'user';
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(turn.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked */ }
  };

  const exportMarkdown = () => {
    const blob = new Blob([`# Oracle Response\n\n${turn.content}\n`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oracle-response-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const exportPDF = () => {
    // Open a print-friendly window with the markdown rendered as plain text.
    const w = window.open('', '_blank', 'width=800,height=600');
    if (w) {
      w.document.write(`<pre style="font-family:system-ui;white-space:pre-wrap;padding:32px;line-height:1.6">${turn.content.replace(/</g, '&lt;')}</pre>`);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 300);
    }
    setExportOpen(false);
  };

  const exportExcel = () => {
    // Export as CSV (Excel-compatible) — splits lines into rows.
    const rows = turn.content.split('\n').map((l) => [l]);
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oracle-response-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

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
            <p className="text-[10px] text-white/30">{time}</p>
            {onEdit && (
              <button
                onClick={onEdit}
                className="text-[10px] text-white/30 opacity-0 transition group-hover:opacity-100 hover:text-amber-300"
                aria-label="Edit prompt"
              >
                <Pencil className="h-3 w-3" />
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
          <span className="text-[10px] text-white/30">{time}</span>
        </div>

        {/* Structured data card (table/stats/chart) — rendered ABOVE the text answer */}
        {turn.structured && !turn.error && (
          <OracleDataCard data={turn.structured} />
        )}

        {/* PROMPT 5: Executive header — tool trace + metrics + scorecard + insights + timeline + recommendations + actions + smart follow-ups */}
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
                <button onClick={onRetry} className="ml-auto flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300">
                  <RefreshCw className="h-3 w-3" /> Try again
                </button>
              )}
            </div>
          ) : (
            <OracleMarkdown content={turn.content} streaming={turn.streaming} />
          )}
        </div>

        {/* ── Premium action row ── */}
        {!turn.error && !turn.streaming && turn.content.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1 px-1">
            <button
              onClick={copyMessage}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
              aria-label="Copy response"
            >
              {copied ? (
                <><Check className="h-3 w-3 text-emerald-400" strokeWidth={2.5} /><span className="text-emerald-400">Copied</span></>
              ) : (
                <><Copy className="h-3 w-3" /><span>Copy</span></>
              )}
            </button>
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
                aria-label="Regenerate response"
              >
                <RefreshCw className="h-3 w-3" /><span>Regenerate</span>
              </button>
            )}
            <button
              onClick={() => { setLiked((v) => !v); if (!liked) onLike?.(); }}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium transition-colors hover:bg-white/5 ${liked ? 'text-emerald-400' : 'text-white/40 hover:text-white/70'}`}
              aria-label="Helpful"
            >
              <ThumbsUp className="h-3 w-3" />
            </button>
            <button
              onClick={() => { setDisliked((v) => !v); if (!disliked) onDislike?.(); }}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium transition-colors hover:bg-white/5 ${disliked ? 'text-rose-400' : 'text-white/40 hover:text-white/70'}`}
              aria-label="Not helpful"
            >
              <ThumbsDown className="h-3 w-3" />
            </button>

            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setExportOpen((v) => !v)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
                aria-label="Export response"
              >
                <Download className="h-3 w-3" /><span>Export</span>
              </button>
              <AnimatePresence>
                {exportOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute left-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-[#1F1F1F] bg-[#0F0F0F] py-1 shadow-xl"
                    >
                      <button onClick={exportPDF} className="flex w-full items-center gap-2 px-3 py-1.5 text-[11.5px] text-white/70 hover:bg-white/5 hover:text-white">
                        <FileText className="h-3.5 w-3.5 text-rose-400" /> PDF
                      </button>
                      <button onClick={exportExcel} className="flex w-full items-center gap-2 px-3 py-1.5 text-[11.5px] text-white/70 hover:bg-white/5 hover:text-white">
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" /> Excel (CSV)
                      </button>
                      <button onClick={exportMarkdown} className="flex w-full items-center gap-2 px-3 py-1.5 text-[11.5px] text-white/70 hover:bg-white/5 hover:text-white">
                        <FileText className="h-3.5 w-3.5 text-amber-400" /> Markdown
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
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

      if (res.ok) return res;

      const bodyText = await res.text().catch(() => '');
      lastError = new Error(`HTTP ${res.status}: ${bodyText}`);

      if (res.status === 401 || res.status === 403) {
        throw new Error('Authentication required. Please sign in again.');
      }

      if (attempt < MAX_RETRIES - 1) {
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
    } catch (err) {
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
    if (err instanceof DOMException && err.name === 'AbortError') {
      handlers.onDone();
      return;
    }
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
  const setFeedback = useOracleConversations((s) => s.setFeedback);

  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
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

    // Show thinking animation for ~2.4s (5 steps × ~480ms) before stream starts
    await new Promise((r) => setTimeout(r, 2400));
    if (controller.signal.aborted) return;
    setShowThinking(false);

    await streamOracle(
      { message, history, userEmail: user?.email, userName: user?.name, userId: user?.id },
      {
        onDelta: (delta) => store.appendDelta(oracleTurnId, delta),
        onFollowUps: (prompts) => store.setFollowUps(oracleTurnId, prompts),
        onStructured: (data) => store.setStructured(oracleTurnId, data),
        onToolTrace: (tools, intent) => store.setToolTrace(oracleTurnId, tools ?? [], intent),
        onMetrics: (metrics) => store.setMetrics(oracleTurnId, metrics ?? []),
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

  const handleEditPrompt = (content: string) => {
    inputRef.current?.setValue(content);
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
          >
            {hasMessages ? (
              <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
                <div className="space-y-6">
                  {messages.map((turn, idx) => (
                    <div key={turn.id}>
                      <LightOracleMessage
                        turn={turn}
                        onPickFollowUp={handlePickSuggestion}
                        onRetry={turn.role === 'oracle' && turn.id === messages[messages.length - 1]?.id ? handleRetry : undefined}
                        onLike={activeId ? () => setFeedback(activeId, 'like') : undefined}
                        onDislike={activeId ? () => setFeedback(activeId, 'dislike') : undefined}
                        onEdit={turn.role === 'user' ? () => handleEditPrompt(turn.content) : undefined}
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
      <MemoryPanel open={memoryOpen} onClose={() => setMemoryOpen(false)} />
      <ConnectorsPanel open={connectorsOpen} onClose={() => setConnectorsOpen(false)} />
      <BusinessGraphPanel open={graphOpen} onClose={() => setGraphOpen(false)} />
    </div>
  );
}

export default OracleChat;
