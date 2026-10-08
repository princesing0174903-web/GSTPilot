'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ Intelligence Layer — Enterprise Workspace
//
// 3-pane layout:
//   ┌──────────────┬────────────────────────────┬──────────────────┐
//   │ Sessions     │ Chat thread                │ Artifacts / Tasks│
//   │ + Agents     │ (streaming, markdown,      │ (tabbed:         │
//   │ + Knowledge  │  tool-calls, citations)    │  Artifacts |     │
//   │              │ + Input bar                │  Tasks |         │
//   │              │                            │  Knowledge)     │
//   └──────────────┴────────────────────────────┴──────────────────┘
//
// Keyboard shortcuts:
//   ⌘K / Ctrl+K — new session
//   ⌘/ / Ctrl+/ — focus the input
//   ⌘Enter      — send (in input)
//   Esc         — blur input / stop streaming
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Plus,
  MessageSquare,
  Send,
  Square,
  Brain,
  Wrench,
  BookOpen,
  ListTodo,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Pin,
  Trash2,
  ChevronRight,
  Clock,
  CheckCircle2,
  Loader2,
  XCircle,
  CornerDownLeft,
  Command,
  Lightbulb,
  ShieldCheck,
  TrendingUp,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { auth } from '@/lib/firebase';
import { useOracleAIChat, type LiveArtifact } from './useOracleAIChat';
import { MessageBubble } from './MessageBubble';
import { ArtifactRenderer } from './ArtifactRenderer';
import type {
  OracleAIAgent,
  OracleAISession,
  OracleAITask,
  OracleAIKnowledge,
  KnowledgeCategory,
} from '@/lib/oracle-ai/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getIdToken(): Promise<string | null> {
  try {
    return auth.currentUser ? await auth.currentUser.getIdToken(false) : null;
  } catch {
    return null;
  }
}

function authHeaders(token: string | null, json = true): Record<string, string> {
  const h: Record<string, string> = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

const AGENT_ICONS: Record<string, React.ElementType> = {
  Sparkles: Sparkles,
  TrendingUp: TrendingUp,
  ShieldCheck: ShieldCheck,
  Search: Search,
  Workflow: Workflow,
  Brain: Brain,
};

const AGENT_COLORS: Record<string, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
  teal: 'bg-teal-500/15 text-teal-400 ring-teal-500/30',
  amber: 'bg-amber-500/15 text-amber-400 ring-amber-500/30',
  sky: 'bg-sky-500/15 text-sky-400 ring-sky-500/30',
  violet: 'bg-violet-500/15 text-violet-400 ring-violet-500/30',
  rose: 'bg-rose-500/15 text-rose-400 ring-rose-500/30',
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function SessionsList({
  sessions,
  activeId,
  loading,
  onSelect,
  onNew,
  onDelete,
}: {
  sessions: OracleAISession[];
  activeId: string | null;
  loading: boolean;
  onSelect: (s: OracleAISession) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Conversations
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onNew}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New conversation (⌘K)</TooltipContent>
        </Tooltip>
      </div>
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-0.5 pb-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-2 py-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="mt-1.5 h-3 w-1/2" />
              </div>
            ))
          ) : sessions.length === 0 ? (
            <div className="px-2 py-6 text-center">
              <MessageSquare className="mx-auto h-6 w-6 text-muted-foreground/50" />
              <p className="mt-2 text-xs text-muted-foreground">No conversations yet</p>
              <Button size="sm" variant="outline" className="mt-3 h-7 text-xs" onClick={onNew}>
                <Plus className="mr-1 h-3 w-3" /> Start one
              </Button>
            </div>
          ) : (
            sessions.map((s) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  'group relative cursor-pointer rounded-md px-2 py-2 transition-colors',
                  activeId === s.id
                    ? 'bg-emerald-500/10 ring-1 ring-emerald-500/20'
                    : 'hover:bg-muted/40',
                )}
                onClick={() => onSelect(s)}
              >
                <div className="flex items-start gap-1.5">
                  <MessageSquare
                    className={cn(
                      'mt-0.5 h-3.5 w-3.5 shrink-0',
                      activeId === s.id ? 'text-emerald-400' : 'text-muted-foreground/60',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-foreground">{s.title}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {s.summary && <span className="truncate">{s.summary.slice(0, 40)}…</span>}
                      <span className="shrink-0">{new Date(s.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(s.id);
                    }}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-400" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function AgentPicker({
  agents,
  selected,
  onSelect,
}: {
  agents: OracleAIAgent[];
  selected: OracleAIAgent | null;
  onSelect: (a: OracleAIAgent) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs hover:bg-muted/50 transition-colors"
      >
        {selected && (() => {
          const Icon = AGENT_ICONS[selected.icon] ?? Sparkles;
          const color = AGENT_COLORS[selected.color] ?? AGENT_COLORS.emerald;
          return (
            <>
              <span className={cn('flex h-5 w-5 items-center justify-center rounded ring-1', color)}>
                <Icon className="h-3 w-3" />
              </span>
              <span className="font-medium text-foreground">{selected.name}</span>
            </>
          );
        })()}
        <ChevronRight className={cn('h-3 w-3 text-muted-foreground transition-transform', open && 'rotate-90')} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute bottom-full left-0 z-20 mb-1 w-64 rounded-md border border-border/60 bg-popover/95 p-1.5 shadow-xl backdrop-blur"
            >
              <div className="px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Agent Persona
              </div>
              {agents.map((a) => {
                const Icon = AGENT_ICONS[a.icon] ?? Sparkles;
                const color = AGENT_COLORS[a.color] ?? AGENT_COLORS.emerald;
                return (
                  <button
                    key={a.id}
                    onClick={() => {
                      onSelect(a);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-start gap-2 rounded px-1.5 py-1.5 text-left transition-colors',
                      selected?.id === a.id ? 'bg-muted/50' : 'hover:bg-muted/30',
                    )}
                  >
                    <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded ring-1', color)}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-foreground">{a.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{a.role}</div>
                    </div>
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ThinkingIndicator({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2.5 px-1 py-1.5 text-xs text-muted-foreground"
    >
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 ring-1 ring-emerald-500/20">
        <Brain className="h-3.5 w-3.5 text-emerald-400" />
      </div>
      <span className="flex items-center gap-1.5">
        {label}
        <span className="flex gap-0.5">
          <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400 [animation-delay:-0.3s]" />
          <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400 [animation-delay:-0.15s]" />
          <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
        </span>
      </span>
    </motion.div>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  const suggestions = [
    { icon: TrendingUp, title: 'Analyze my receivables', text: 'Show me my receivables aging and suggest collection actions for the top 5 overdue invoices.' },
    { icon: ShieldCheck, title: 'GST compliance check', text: 'Are there any upcoming GST filing deadlines or pending notices I should address this week?' },
    { icon: Brain, title: 'Cash flow forecast', text: 'Forecast my cash flow for the next 30 days based on current receivables and payables.' },
    { icon: Lightbulb, title: 'Business insights', text: 'What are the top 3 financial risks in my business right now and how do I mitigate them?' },
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 ring-1 ring-emerald-500/30"
      >
        <Sparkles className="h-7 w-7 text-emerald-400" />
      </motion.div>
      <h2 className="text-lg font-semibold text-foreground">VEYRO AI Intelligence Layer</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Your enterprise AI workspace. Ask anything about your business — Oracle reasons, calls tools, and produces rich artifacts.
      </p>
      <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map((s, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            onClick={() => onSuggestion(s.text)}
            className="group flex items-start gap-2.5 rounded-lg border border-border/60 bg-card/40 p-3 text-left transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/5"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/40 text-muted-foreground group-hover:bg-emerald-500/15 group-hover:text-emerald-400 transition-colors">
              <s.icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground">{s.title}</div>
              <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{s.text}</div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: OracleAITask }) {
  const statusIcon = {
    queued: <Clock className="h-3 w-3 text-muted-foreground" />,
    running: <Loader2 className="h-3 w-3 animate-spin text-amber-400" />,
    completed: <CheckCircle2 className="h-3 w-3 text-emerald-400" />,
    failed: <XCircle className="h-3 w-3 text-red-400" />,
    cancelled: <XCircle className="h-3 w-3 text-muted-foreground" />,
  }[task.status];
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/20 px-2 py-1.5 text-xs">
      <span className="flex h-5 w-5 items-center justify-center">{statusIcon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-foreground">{task.title}</div>
        <div className="text-[11px] text-muted-foreground">
          {task.type} · P{task.priority}
          {task.progress > 0 && task.status === 'running' && ` · ${task.progress}%`}
        </div>
      </div>
      {task.status === 'running' && (
        <div className="h-1 w-12 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-amber-400 transition-all" style={{ width: `${task.progress}%` }} />
        </div>
      )}
    </div>
  );
}

function KnowledgeRow({ entry, onSelect }: { entry: OracleAIKnowledge; onSelect: (e: OracleAIKnowledge) => void }) {
  const colorMap: Record<string, string> = {
    gst: 'bg-emerald-500/15 text-emerald-400',
    compliance: 'bg-amber-500/15 text-amber-400',
    finance: 'bg-teal-500/15 text-teal-400',
    operations: 'bg-sky-500/15 text-sky-400',
    legal: 'bg-rose-500/15 text-rose-400',
    general: 'bg-muted text-muted-foreground',
  };
  return (
    <button
      onClick={() => onSelect(entry)}
      className="flex w-full items-start gap-2 rounded-md border border-border/40 bg-muted/20 px-2 py-1.5 text-left transition-colors hover:bg-muted/40"
    >
      <Badge className={cn('shrink-0 text-[11px]', colorMap[entry.category])}>{entry.category}</Badge>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-foreground">{entry.title}</div>
        <div className="truncate text-[11px] text-muted-foreground">{entry.content.slice(0, 80)}</div>
      </div>
      {entry.pinned && <Pin className="h-3 w-3 shrink-0 text-amber-400" />}
    </button>
  );
}

// ─── Main Workspace ──────────────────────────────────────────────────────────

export default function OracleAIWorkspacePage() {
  const [sessions, setSessions] = useState<OracleAISession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<OracleAISession | null>(null);
  const [agents, setAgents] = useState<OracleAIAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<OracleAIAgent | null>(null);
  const [input, setInput] = useState('');
  const [rightTab, setRightTab] = useState<'artifacts' | 'tasks' | 'knowledge'>('artifacts');
  const [rightOpen, setRightOpen] = useState(true);
  const [tasks, setTasks] = useState<OracleAITask[]>([]);
  const [knowledge, setKnowledge] = useState<OracleAIKnowledge[]>([]);
  const [knowledgeQuery, setKnowledgeQuery] = useState('');
  const [liveArtifacts, setLiveArtifacts] = useState<LiveArtifact[]>([]);
  const [creatingSession, setCreatingSession] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chat = useOracleAIChat({
    sessionId: activeSession?.id ?? null,
    onArtifactsChange: setLiveArtifacts,
    onTaskActivity: () => {
      // Refresh task list when a tool creates a task
      void refreshTasks();
    },
  });

  // ─── Load sessions ─────────────────────────────────────────────────────────
  const refreshSessions = useCallback(async () => {
    try {
      const token = await getIdToken();
      const res = await fetch('/api/oracle-ai/sessions?limit=50', { headers: authHeaders(token, false) });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } catch {
      // non-fatal
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  // ─── Load agents ───────────────────────────────────────────────────────────
  const refreshAgents = useCallback(async () => {
    try {
      const token = await getIdToken();
      const res = await fetch('/api/oracle-ai/agents', { headers: authHeaders(token, false) });
      if (res.ok) {
        const data = await res.json();
        const list: OracleAIAgent[] = data.agents ?? [];
        setAgents(list);
        if (!selectedAgent && list.length > 0) setSelectedAgent(list[0]);
      }
    } catch {
      // non-fatal
    }
  }, [selectedAgent]);

  // ─── Load tasks ────────────────────────────────────────────────────────────
  const refreshTasks = useCallback(async () => {
    try {
      const token = await getIdToken();
      const res = await fetch('/api/oracle-ai/tasks?limit=50', { headers: authHeaders(token, false) });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks ?? []);
      }
    } catch {
      // non-fatal
    }
  }, []);

  // ─── Load knowledge ────────────────────────────────────────────────────────
  const refreshKnowledge = useCallback(async (query?: string) => {
    try {
      const token = await getIdToken();
      const url = query
        ? `/api/oracle-ai/knowledge?q=${encodeURIComponent(query)}&limit=30`
        : '/api/oracle-ai/knowledge?limit=30';
      const res = await fetch(url, { headers: authHeaders(token, false) });
      if (res.ok) {
        const data = await res.json();
        setKnowledge(data.entries ?? []);
      }
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
    void refreshAgents();
    void refreshTasks();
    void refreshKnowledge();
  }, [refreshSessions, refreshAgents, refreshTasks, refreshKnowledge]);

  // Refresh tasks every 8s for live status updates
  useEffect(() => {
    const interval = setInterval(() => void refreshTasks(), 8000);
    return () => clearInterval(interval);
  }, [refreshTasks]);

  // ─── Create new session ────────────────────────────────────────────────────
  const handleNewSession = useCallback(async () => {
    if (creatingSession) return;
    setCreatingSession(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/oracle-ai/sessions', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ title: 'New conversation', agentId: selectedAgent?.id }),
      });
      if (res.ok) {
        const data = await res.json();
        const s: OracleAISession = data.session;
        setSessions((prev) => [s, ...prev]);
        setActiveSession(s);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } catch {
      // non-fatal
    } finally {
      setCreatingSession(false);
    }
  }, [creatingSession, selectedAgent]);

  // ─── Delete session ────────────────────────────────────────────────────────
  const handleDeleteSession = useCallback(async (id: string) => {
    try {
      const token = await getIdToken();
      await fetch(`/api/oracle-ai/sessions/${id}`, {
        method: 'DELETE',
        headers: authHeaders(token, false),
      });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSession?.id === id) setActiveSession(null);
    } catch {
      // non-fatal
    }
  }, [activeSession]);

  // ─── Send message ──────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || chat.streaming) return;
    if (!activeSession) {
      // Auto-create a session on first message
      await handleNewSession();
      // Wait a tick for the session to be set
      await new Promise((r) => setTimeout(r, 150));
    }
    setInput('');
    // The chat hook needs the active session id — but state update is async.
    // We rely on the hook's `sessionId` prop which will update on next render.
    // To send immediately, we call sendMessage after the session is set.
    setTimeout(() => {
      void chat.sendMessage(text, { agentId: selectedAgent?.id });
    }, 50);
  }, [input, chat, activeSession, handleNewSession, selectedAgent]);

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === 'k') {
        e.preventDefault();
        void handleNewSession();
      } else if (meta && e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (chat.streaming) chat.stop();
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleNewSession, chat]);

  // ─── Auto-scroll to bottom on new messages ─────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat.messages, chat.streamingText, chat.thinking]);

  const activeTasks = useMemo(() => tasks.slice(0, 20), [tasks]);
  const visibleArtifacts = activeSession ? liveArtifacts : [];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-background">
        {/* ─── Left rail: Sessions ─────────────────────────────────────────── */}
        <aside className="hidden w-64 shrink-0 border-r border-border/40 bg-card/20 md:flex md:flex-col">
          <SessionsList
            sessions={sessions}
            activeId={activeSession?.id ?? null}
            loading={sessionsLoading}
            onSelect={setActiveSession}
            onNew={handleNewSession}
            onDelete={handleDeleteSession}
          />
        </aside>

        {/* ─── Center: Chat ────────────────────────────────────────────────── */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/40 px-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500/20 to-teal-500/10 ring-1 ring-emerald-500/30">
              <Sparkles className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">
                {activeSession?.title ?? 'VEYRO AI Workspace'}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {activeSession ? `${activeSession.messageCount} messages` : 'Select or start a conversation'}
              </div>
            </div>
            {selectedAgent && (
              <AgentPicker agents={agents} selected={selectedAgent} onSelect={setSelectedAgent} />
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setRightOpen((v) => !v)}
                >
                  {rightOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Toggle panel</TooltipContent>
            </Tooltip>
          </header>

          {/* Chat thread */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            {!activeSession ? (
              <EmptyState
                onSuggestion={async (text) => {
                  await handleNewSession();
                  setInput(text);
                  setTimeout(() => inputRef.current?.focus(), 150);
                }}
              />
            ) : chat.loadingHistory ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-1/3" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-4/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : chat.messages.length === 0 && !chat.streaming ? (
              <EmptyState
                onSuggestion={(text) => {
                  setInput(text);
                  inputRef.current?.focus();
                }}
              />
            ) : (
              <div className="mx-auto max-w-3xl space-y-5">
                {chat.messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    artifacts={chat.artifacts}
                    toolCalls={chat.toolCalls}
                    citations={chat.citations}
                    isStreaming={chat.streaming && m.id === chat.streamingMessageId}
                    streamingText={chat.streamingText}
                  />
                ))}
                {/* Live streaming bubble */}
                {chat.streaming && chat.streamingMessageId && !chat.messages.find((m) => m.id === chat.streamingMessageId) && (
                  <MessageBubble
                    message={{
                      id: chat.streamingMessageId,
                      sessionId: activeSession.id,
                      firmId: '',
                      userId: null,
                      role: 'assistant',
                      content: '',
                      parts: [],
                      model: null,
                      tokensIn: 0,
                      tokensOut: 0,
                      latencyMs: 0,
                      status: 'streaming',
                      error: null,
                      agentId: selectedAgent?.id ?? null,
                      toolName: null,
                      parentMessageId: null,
                      createdAt: new Date().toISOString(),
                    }}
                    artifacts={chat.artifacts}
                    toolCalls={chat.toolCalls}
                    citations={chat.citations}
                    isStreaming
                    streamingText={chat.streamingText}
                  />
                )}
                {chat.thinking && (
                  <ThinkingIndicator label={chat.thinking} />
                )}
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="shrink-0 border-t border-border/40 bg-card/20 px-4 py-3">
            <div className="mx-auto max-w-3xl">
              {chat.error && (
                <div className="mb-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-1.5 text-xs text-red-400">
                  {chat.error}
                </div>
              )}
              <div className="relative rounded-xl border border-border/60 bg-background/60 focus-within:border-emerald-500/40 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-colors">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Ask VEYRO AI anything about your business…"
                  className="min-h-[44px] max-h-[160px] resize-none border-0 bg-transparent px-3 py-2.5 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  rows={1}
                />
                <div className="flex items-center justify-between border-t border-border/40 px-2 py-1.5">
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <kbd className="flex items-center gap-0.5 rounded border border-border/60 px-1 py-0.5"><Command className="h-2.5 w-2.5" />K</kbd>
                    <span>new</span>
                    <span className="mx-1">·</span>
                    <kbd className="flex items-center gap-0.5 rounded border border-border/60 px-1 py-0.5">
                      <CornerDownLeft className="h-2.5 w-2.5" />
                    </kbd>
                    <span>send</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {chat.streaming ? (
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={chat.stop}>
                        <Square className="h-3 w-3" /> Stop
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="h-7 gap-1 text-xs bg-emerald-500/90 hover:bg-emerald-500 text-white"
                        onClick={handleSend}
                        disabled={!input.trim()}
                      >
                        <Send className="h-3 w-3" /> Send
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ─── Right panel: Artifacts / Tasks / Knowledge ───────────────────── */}
        <AnimatePresence>
          {rightOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="hidden shrink-0 border-l border-border/40 bg-card/20 lg:flex lg:flex-col overflow-hidden"
            >
              <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border/40 px-2">
                <button
                  onClick={() => setRightTab('artifacts')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                    rightTab === 'artifacts' ? 'bg-emerald-500/10 text-emerald-400' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Wrench className="h-3.5 w-3.5" /> Artifacts
                  {visibleArtifacts.length > 0 && (
                    <Badge variant="secondary" className="text-[11px] px-1 py-0">{visibleArtifacts.length}</Badge>
                  )}
                </button>
                <button
                  onClick={() => setRightTab('tasks')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                    rightTab === 'tasks' ? 'bg-emerald-500/10 text-emerald-400' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <ListTodo className="h-3.5 w-3.5" /> Tasks
                  {tasks.filter((t) => t.status === 'queued' || t.status === 'running').length > 0 && (
                    <Badge variant="secondary" className="text-[11px] px-1 py-0 bg-amber-500/20 text-amber-400">
                      {tasks.filter((t) => t.status === 'queued' || t.status === 'running').length}
                    </Badge>
                  )}
                </button>
                <button
                  onClick={() => setRightTab('knowledge')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                    rightTab === 'knowledge' ? 'bg-emerald-500/10 text-emerald-400' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <BookOpen className="h-3.5 w-3.5" /> Knowledge
                </button>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-2 p-3">
                  {rightTab === 'artifacts' && (
                    visibleArtifacts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <Wrench className="h-6 w-6 text-muted-foreground/40" />
                        <p className="mt-2 text-xs text-muted-foreground">Artifacts produced by Oracle will appear here</p>
                      </div>
                    ) : (
                      visibleArtifacts.map((a) => (
                        <ArtifactRenderer key={a.artifactId} kind={a.kind} title={a.title} data={a.data} compact />
                      ))
                    )
                  )}

                  {rightTab === 'tasks' && (
                    activeTasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <ListTodo className="h-6 w-6 text-muted-foreground/40" />
                        <p className="mt-2 text-xs text-muted-foreground">No tasks in the queue</p>
                      </div>
                    ) : (
                      activeTasks.map((t) => <TaskRow key={t.id} task={t} />)
                    )
                  )}

                  {rightTab === 'knowledge' && (
                    <>
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={knowledgeQuery}
                          onChange={(e) => {
                            setKnowledgeQuery(e.target.value);
                            void refreshKnowledge(e.target.value);
                          }}
                          placeholder="Search knowledge…"
                          className="h-7 pl-7 text-xs"
                        />
                      </div>
                      {knowledge.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <BookOpen className="h-6 w-6 text-muted-foreground/40" />
                          <p className="mt-2 text-xs text-muted-foreground">No knowledge entries yet</p>
                        </div>
                      ) : (
                        knowledge.map((e) => <KnowledgeRow key={e.id} entry={e} onSelect={() => {}} />)
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}
