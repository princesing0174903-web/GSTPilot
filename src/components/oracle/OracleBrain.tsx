'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ Brain — The Brain of GSTPilot
// ═══════════════════════════════════════════════════════════════════════════════
//
// ChatGPT Enterprise-style AI assistant. Reads live business data via tools,
// takes real actions, and remembers workspace context across conversations.
//
// Layout:
//   ┌─────────────┬──────────────────────────────────┐
//   │ Sidebar     │ Chat area                        │
//   │ • New chat  │ • Messages (streaming)           │
//   │ • Sessions  │ • Tool-call cards                │
//   │ • Memory    │ • Input bar                      │
//   └─────────────┴──────────────────────────────────┘
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Brain, Send, Plus, MessageSquare, Trash2, Sparkles, TrendingUp,
  Receipt, Users, AlertTriangle, FileText, Database, Zap, Clock,
  ChevronRight, Loader2, BrainCircuit, Wrench, CheckCircle2, XCircle,
  Menu, X, Lightbulb, IndianRupee, ShieldCheck, BarChart3,
  Copy, RotateCcw, Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useOrg } from '@/contexts/OrgContext';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parts: MessagePart[];
  createdAt: string;
  streaming?: boolean;
}

interface MessagePart {
  type: 'tool-call';
  tool: string;
  args: Record<string, any>;
  result?: string;
  error?: string;
  durationMs?: number;
}

interface Session {
  id: string;
  title: string;
  status: string;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MemoryFact {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  tags: string[];
  importance: number;
  source: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ToolEvent {
  id: string;
  tool: string;
  args: Record<string, any>;
  status: 'running' | 'success' | 'error';
  result?: string;
  error?: string;
  durationMs?: number;
  artifacts?: any[];
}

// ─── Suggested prompts (the "golden path" for first-time users) ───────────────

const SUGGESTED_PROMPTS = [
  {
    icon: TrendingUp,
    color: 'text-emerald-400',
    title: 'How is my business doing?',
    prompt: 'Give me a snapshot of how my business is doing right now. Revenue, profit, cash, and any risks.',
    skill: 'Finance',
  },
  {
    icon: AlertTriangle,
    color: 'text-amber-400',
    title: 'Who owes me money?',
    prompt: 'Show me all overdue customers and the total outstanding amount. Which ones should I follow up with first?',
    skill: 'CRM',
  },
  {
    icon: Receipt,
    color: 'text-sky-400',
    title: 'What is my GST liability?',
    prompt: 'What is my current GST liability? How much output tax have I collected vs input tax credit available?',
    skill: 'GST',
  },
  {
    icon: IndianRupee,
    color: 'text-violet-400',
    title: 'Analyze my cashflow',
    prompt: 'Analyze my cashflow. Am I in a healthy position? What\'s my runway and collection rate?',
    skill: 'Banking',
  },
  {
    icon: FileText,
    color: 'text-rose-400',
    title: 'Create an invoice',
    prompt: 'Create an invoice for Acme Corp for 10 units of Consulting Services at ₹5,000 each with 18% GST.',
    skill: 'Action',
  },
  {
    icon: Zap,
    color: 'text-yellow-400',
    title: 'Send overdue reminders',
    prompt: 'Send payment reminders to all my overdue customers via email.',
    skill: 'Automation',
  },
];

const SKILLS = [
  { name: 'Finance', icon: TrendingUp, color: 'text-emerald-400' },
  { name: 'GST', icon: Receipt, color: 'text-sky-400' },
  { name: 'CRM', icon: Users, color: 'text-blue-400' },
  { name: 'Banking', icon: IndianRupee, color: 'text-violet-400' },
  { name: 'Reports', icon: BarChart3, color: 'text-orange-400' },
];

const TOOL_ICONS: Record<string, any> = {
  getBusinessSnapshot: TrendingUp,
  queryInvoices: Receipt,
  queryCustomers: Users,
  queryExpenses: IndianRupee,
  queryPayments: IndianRupee,
  getGSTStatus: Receipt,
  getOverdueCustomers: AlertTriangle,
  getCashflowAnalysis: TrendingUp,
  getTopCustomer: Users,
  getNewestInvoice: Receipt,
  getInvoiceMetrics: BarChart3,
  getRecentActivity: Clock,
  getConnectedIntegrations: ShieldCheck,
  createInvoice: FileText,
  sendReminder: Send,
  recallMemory: Brain,
  saveMemory: Brain,
};

const TOOL_LABELS: Record<string, string> = {
  getBusinessSnapshot: 'Business Snapshot',
  queryInvoices: 'Query Invoices',
  queryCustomers: 'Query Customers',
  queryExpenses: 'Query Expenses',
  queryPayments: 'Query Payments',
  getGSTStatus: 'GST Status',
  getOverdueCustomers: 'Overdue Customers',
  getCashflowAnalysis: 'Cashflow Analysis',
  getTopCustomer: 'Top Customer',
  getNewestInvoice: 'Newest Invoice',
  getInvoiceMetrics: 'Invoice Metrics',
  getRecentActivity: 'Recent Activity',
  getConnectedIntegrations: 'Integrations',
  createInvoice: 'Create Invoice',
  sendReminder: 'Send Reminder',
  recallMemory: 'Recall Memory',
  saveMemory: 'Save Memory',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function OracleBrain() {
  const { organization, isPreviewMode } = useOrg();
  const orgId = organization?.id ?? null;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [memory, setMemory] = useState<MemoryFact[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ─── Load sessions + memory when orgId changes ──────────────────────────────
  useEffect(() => {
    if (!orgId) return;
    refreshSessions();
    refreshMemory();
  }, [orgId]);

  const refreshSessions = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/oracle/brain/sessions?orgId=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } catch (e) {
      console.error('Failed to load sessions:', e);
    }
  }, [orgId]);

  const refreshMemory = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/oracle/brain/memory?orgId=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setMemory(data.facts ?? []);
      }
    } catch (e) {
      console.error('Failed to load memory:', e);
    }
  }, [orgId]);

  // ─── Load messages when session changes ─────────────────────────────────────
  const loadSession = useCallback(async (sessionId: string) => {
    if (!orgId) return;
    setLoadingSession(true);
    try {
      const res = await fetch(
        `/api/oracle/brain/sessions/${sessionId}?orgId=${encodeURIComponent(orgId)}`
      );
      if (res.ok) {
        const data = await res.json();
        const msgs: ChatMessage[] = (data.messages ?? []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          parts: m.parts ?? [],
          createdAt: m.createdAt,
        }));
        setMessages(msgs);
        setCurrentSessionId(sessionId);
        setSidebarOpen(false);
      }
    } catch (e) {
      console.error('Failed to load session:', e);
    } finally {
      setLoadingSession(false);
    }
  }, [orgId]);

  const startNewChat = useCallback(() => {
    setCurrentSessionId(null);
    setMessages([]);
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ─── Auto-scroll on new messages ────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  // ─── Send message (the core streaming chat) ─────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming || !orgId) return;

    setInput('');
    setIsStreaming(true);

    // Optimistic user message
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      parts: [],
      createdAt: new Date().toISOString(),
    };

    // Optimistic assistant message (streaming placeholder)
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      parts: [],
      createdAt: new Date().toISOString(),
      streaming: true,
    };

    // Active tool events for this turn
    const toolEvents: ToolEvent[] = [];

    setMessages(prev => [...prev, userMsg, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/oracle/brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          sessionId: currentSessionId,
          orgId,
          userId: undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let resolvedSessionId = currentSessionId;

      const updateAssistant = (updater: (m: ChatMessage) => ChatMessage) => {
        setMessages(prev => prev.map(m => m.id === assistantId ? updater(m) : m));
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events (separated by \n\n)
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const evt of events) {
          const line = evt.split('\n').find(l => l.startsWith('data:'));
          if (!line) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const data = JSON.parse(payload);
            switch (data.type) {
              case 'session':
                resolvedSessionId = data.sessionId;
                setCurrentSessionId(data.sessionId);
                break;
              case 'token':
                updateAssistant(m => ({ ...m, content: m.content + (data.text || '') }));
                break;
              case 'tool-start': {
                const te: ToolEvent = {
                  id: `te-${Date.now()}-${Math.random()}`,
                  tool: data.tool,
                  args: data.args ?? {},
                  status: 'running',
                };
                toolEvents.push(te);
                updateAssistant(m => ({ ...m, parts: [...m.parts, {
                  type: 'tool-call' as const,
                  tool: te.tool,
                  args: te.args,
                }] }));
                break;
              }
              case 'tool-result': {
                const te = toolEvents.find(t => t.tool === data.tool && t.status === 'running');
                if (te) {
                  te.status = 'success';
                  te.result = data.result?.summary;
                  te.durationMs = data.durationMs;
                  te.artifacts = data.result?.artifacts;
                }
                updateAssistant(m => ({
                  ...m,
                  parts: m.parts.map((p, i) =>
                    i === m.parts.length - 1 && p.type === 'tool-call' && p.tool === data.tool && !p.result
                      ? { ...p, result: data.result?.summary, durationMs: data.durationMs }
                      : p
                  ),
                }));
                // Refresh memory if a memory tool was called
                if (data.tool === 'saveMemory' || data.tool === 'recallMemory') {
                  refreshMemory();
                }
                break;
              }
              case 'tool-error': {
                updateAssistant(m => ({
                  ...m,
                  parts: m.parts.map((p, i) =>
                    i === m.parts.length - 1 && p.type === 'tool-call' && p.tool === data.tool && !p.error
                      ? { ...p, error: data.error, durationMs: data.durationMs }
                      : p
                  ),
                }));
                break;
              }
              case 'done':
                updateAssistant(m => ({ ...m, streaming: false }));
                refreshSessions();
                break;
              case 'error':
                updateAssistant(m => ({
                  ...m,
                  streaming: false,
                  content: m.content || `⚠️ ${data.error || 'Something went wrong.'}`,
                }));
                toast.error(data.error || 'Oracle encountered an error');
                break;
            }
          } catch (e) {
            // partial JSON — ignore
          }
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        updateAssistantPlaceholder(assistantId, m => ({ ...m, streaming: false, content: m.content + '\n\n_(stopped)_' }));
      } else {
        console.error('Chat error:', e);
        setMessages(prev => prev.map(m => m.id === assistantId
          ? { ...m, streaming: false, content: `⚠️ Connection error: ${e.message}. Please try again.` }
          : m));
        toast.error('Failed to reach Oracle');
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }

    function updateAssistantPlaceholder(id: string, updater: (m: ChatMessage) => ChatMessage) {
      setMessages(prev => prev.map(m => m.id === id ? updater(m) : m));
    }
  }, [orgId, currentSessionId, isStreaming, refreshSessions, refreshMemory]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  // Regenerate the last assistant response: remove it, find the last user message, re-send it
  const handleRegenerate = useCallback(() => {
    if (isStreaming) return;
    setMessages(prev => {
      // Remove trailing assistant message
      const withoutLast = prev.slice(0, -1);
      // Find the last user message
      const lastUserIdx = withoutLast.map(m => m.role).lastIndexOf('user');
      if (lastUserIdx === -1) return prev;
      const lastUserMsg = withoutLast[lastUserIdx];
      const remaining = withoutLast.slice(0, lastUserIdx);
      // Re-send the user message (async, fire-and-forget — sendMessage adds messages back)
      // Use a microtask so setMessages completes first
      queueMicrotask(() => sendMessage(lastUserMsg.content));
      return remaining;
    });
  }, [isStreaming, sendMessage]);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!orgId) return;
    try {
      await fetch(`/api/oracle/brain/sessions/${sessionId}?orgId=${encodeURIComponent(orgId)}`, {
        method: 'DELETE',
      });
      if (currentSessionId === sessionId) {
        startNewChat();
      }
      refreshSessions();
      toast.success('Conversation deleted');
    } catch (e) {
      toast.error('Failed to delete conversation');
    }
  }, [orgId, currentSessionId, refreshSessions, startNewChat]);

  const deleteMemory = useCallback(async (factId: string) => {
    if (!orgId) return;
    try {
      await fetch(`/api/oracle/brain/memory?orgId=${encodeURIComponent(orgId)}&id=${encodeURIComponent(factId)}`, {
        method: 'DELETE',
      });
      refreshMemory();
      toast.success('Memory deleted');
    } catch (e) {
      toast.error('Failed to delete memory');
    }
  }, [orgId, refreshMemory]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full w-full flex bg-background overflow-hidden">
      {/* ─── Sidebar ─── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
        fixed md:relative z-40 md:z-0
        w-[280px] shrink-0 h-full
        bg-zinc-950 border-r border-zinc-800
        flex flex-col
        transition-transform duration-200
      `}>
        {/* New chat */}
        <div className="p-3 border-b border-zinc-800">
          <Button
            onClick={startNewChat}
            className="w-full justify-start gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-800"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            New conversation
          </Button>
        </div>

        {/* Sessions list */}
        <ScrollArea className="flex-1 px-2">
          <div className="py-2 space-y-0.5">
            <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Conversations
            </div>
            {sessions.length === 0 ? (
              <div className="px-2 py-3 text-xs text-zinc-600">
                No conversations yet. Start by asking Oracle anything about your business.
              </div>
            ) : (
              sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => loadSession(s.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg group flex items-start gap-2 transition-colors ${
                    currentSessionId === s.id
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-60" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{s.title}</div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">
                      {s.messageCount} messages · {timeAgo(s.updatedAt)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-zinc-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Memory panel */}
        <div className="border-t border-zinc-800 max-h-[40%] flex flex-col">
          <div className="px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Memory</span>
            </div>
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{memory.length}</Badge>
          </div>
          <ScrollArea className="flex-1 px-2 pb-2">
            {memory.length === 0 ? (
              <div className="px-2 py-2 text-[11px] text-zinc-600 leading-relaxed">
                Oracle will remember facts about your business here — company name, GSTIN, preferences. Just tell Oracle to "remember" something.
              </div>
            ) : (
              <div className="space-y-1 pb-2">
                {memory.map(f => (
                  <div key={f.id} className="group px-2 py-1.5 rounded-md hover:bg-zinc-900 text-[11px]">
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-medium text-zinc-300 truncate">{f.title}</span>
                      <button
                        onClick={() => deleteMemory(f.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <X className="h-3 w-3 text-zinc-600 hover:text-rose-400" />
                      </button>
                    </div>
                    {f.summary && <div className="text-zinc-500 text-[10px] mt-0.5 line-clamp-2">{f.summary}</div>}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </aside>

      {/* ─── Main chat area ─── */}
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Header */}
        <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-md hover:bg-zinc-900 text-zinc-400"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/30 blur-md rounded-full" />
                <BrainCircuit className="h-6 w-6 text-emerald-400 relative" />
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-100">Oracle</div>
                <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  The brain of GSTPilot
                </div>
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            {SKILLS.map(s => {
              const Icon = s.icon;
              return (
                <div key={s.name} className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-900/60 border border-zinc-800">
                  <Icon className={`h-3 w-3 ${s.color}`} />
                  <span className="text-[10px] text-zinc-400 font-medium">{s.name}</span>
                </div>
              );
            })}
          </div>
        </header>

        {/* Messages or welcome screen */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <WelcomeScreen onPrompt={sendMessage} orgId={orgId} isPreviewMode={isPreviewMode} />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {loadingSession && (
                <div className="flex items-center justify-center py-8 text-zinc-500">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading conversation…
                </div>
              )}
              {messages.map((m, i) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isLast={i === messages.length - 1}
                  onRegenerate={i === messages.length - 1 && m.role === 'assistant' && !m.streaming ? handleRegenerate : undefined}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="border-t border-zinc-800 bg-background p-3 md:p-4 shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2">
              <div className="relative flex-1">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                  placeholder="Ask Oracle anything about your business…"
                  disabled={isStreaming || !orgId}
                  className="h-12 pr-4 pl-4 bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 rounded-xl text-sm focus-visible:ring-1 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/40"
                />
              </div>
              {isStreaming ? (
                <Button
                  onClick={stopStreaming}
                  size="icon"
                  className="h-12 w-12 rounded-xl bg-zinc-800 hover:bg-rose-600/90 text-zinc-300 hover:text-white border border-zinc-700 hover:border-rose-500 transition-colors"
                  variant="outline"
                  title="Stop generating"
                >
                  <Square className="h-4 w-4 fill-current" />
                </Button>
              ) : (
                <Button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || !orgId}
                  size="icon"
                  className="h-12 w-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="text-[10px] text-zinc-600 mt-2 text-center">
              Oracle reads live data from your database and can take real actions. Always verify important figures.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Welcome screen with suggested prompts
// ═══════════════════════════════════════════════════════════════════════════════

function WelcomeScreen({
  onPrompt,
  orgId,
  isPreviewMode,
}: {
  onPrompt: (text: string) => void;
  orgId: string | null;
  isPreviewMode: boolean;
}) {
  return (
    <div className="h-full flex items-center justify-center px-4 py-8">
      <div className="max-w-2xl w-full">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full" />
              <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 flex items-center justify-center">
                <BrainCircuit className="h-8 w-8 text-emerald-400" />
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-zinc-100 mb-2">
            How can I help your business today?
          </h1>
          <p className="text-sm text-zinc-500 max-w-md mx-auto">
            I'm Oracle — your AI CFO, COO, and compliance officer. I read your live business data, take real actions, and remember what matters.
          </p>
          {isPreviewMode && (
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
              <Lightbulb className="h-3.5 w-3.5" />
              Demo mode — create real data (invoices, customers) to see Oracle work
            </div>
          )}
        </motion.div>

        {/* Suggested prompts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUGGESTED_PROMPTS.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.button
                key={p.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 * i }}
                onClick={() => onPrompt(p.prompt)}
                disabled={!orgId}
                className="group text-left p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-lg bg-zinc-800/80 flex items-center justify-center shrink-0 group-hover:bg-zinc-800 transition-colors`}>
                    <Icon className={`h-4 w-4 ${p.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-zinc-200">{p.title}</div>
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-zinc-500 border-zinc-700">{p.skill}</Badge>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1 line-clamp-2">{p.prompt}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Capabilities */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-zinc-600">
          <div className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5" />
            Reads live data
          </div>
          <div className="flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" />
            Takes actions
          </div>
          <div className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5" />
            Remembers context
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Tenant-scoped
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Message bubble with tool-call cards
// ═══════════════════════════════════════════════════════════════════════════════

function MessageBubble({ message, isLast, onRegenerate }: { message: ChatMessage; isLast?: boolean; onRegenerate?: () => void }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!message.content) return;
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => toast.error('Failed to copy'));
  }, [message.content]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div className={`
        h-8 w-8 rounded-lg flex items-center justify-center shrink-0
        ${isUser
          ? 'bg-zinc-800 text-zinc-300'
          : 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 text-emerald-400'}
      `}>
        {isUser ? <Users className="h-4 w-4" /> : <BrainCircuit className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 ${isUser ? 'flex justify-end' : ''}`}>
        {isUser ? (
          <div className="inline-block max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-zinc-800 text-zinc-100 text-sm">
            {message.content}
          </div>
        ) : (
          <div className="space-y-3 max-w-[90%]">
            {/* Tool call cards */}
            {message.parts.filter(p => p.type === 'tool-call').map((p, i) => (
              <ToolCallCard key={i} part={p as Extract<MessagePart, { type: 'tool-call' }>} />
            ))}

            {/* Text content */}
            {message.content && (
              <div className="prose prose-invert prose-sm max-w-none
                prose-headings:text-zinc-100 prose-headings:font-semibold
                prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
                prose-p:text-zinc-300 prose-p:leading-relaxed
                prose-li:text-zinc-300 prose-strong:text-zinc-100
                prose-code:text-emerald-300 prose-code:bg-zinc-800/80 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800
                prose-a:text-emerald-400
                prose-table:text-sm prose-th:text-zinc-200 prose-td:text-zinc-400
                prose-th:bg-zinc-900 prose-td:border-prose-th:border-zinc-800
              ">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            )}

            {/* Streaming indicator */}
            {message.streaming && !message.content && message.parts.length === 0 && (
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 rounded-full bg-emerald-400/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 rounded-full bg-emerald-400/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs">Oracle is thinking…</span>
              </div>
            )}
            {message.streaming && message.content && (
              <span className="inline-block h-4 w-1.5 bg-emerald-400 animate-pulse align-middle" />
            )}

            {/* Action row: Copy + Regenerate (only when not streaming) */}
            {!message.streaming && message.content && (
              <div className="flex items-center gap-1 pt-1">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
                  title="Copy response"
                >
                  {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                {onRegenerate && (
                  <button
                    onClick={onRegenerate}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
                    title="Regenerate response"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Regenerate
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tool call card — shows what Oracle is doing / did
// ═══════════════════════════════════════════════════════════════════════════════

function ToolCallCard({ part }: { part: Extract<MessagePart, { type: 'tool-call' }> }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOOL_ICONS[part.tool] ?? Wrench;
  const label = TOOL_LABELS[part.tool] ?? part.tool;
  const isRunning = !part.result && !part.error;

  return (
    <div className={`
      rounded-lg border overflow-hidden
      ${part.error
        ? 'border-rose-500/30 bg-rose-500/5'
        : part.result
          ? 'border-zinc-800 bg-zinc-900/60'
          : 'border-emerald-500/30 bg-emerald-500/5'}
    `}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-zinc-800/40 transition-colors"
      >
        <div className={`
          h-6 w-6 rounded-md flex items-center justify-center shrink-0
          ${part.error ? 'bg-rose-500/10' : part.result ? 'bg-zinc-800' : 'bg-emerald-500/10'}
        `}>
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 text-emerald-400 animate-spin" />
          ) : part.error ? (
            <XCircle className="h-3.5 w-3.5 text-rose-400" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <span className="text-xs font-medium text-zinc-200 truncate">{label}</span>
            {isRunning && (
              <Badge variant="outline" className="text-[9px] h-3.5 px-1 text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                running
              </Badge>
            )}
            {part.durationMs != null && (
              <span className="text-[10px] text-zinc-600">{part.durationMs}ms</span>
            )}
          </div>
        </div>
        <ChevronRight className={`h-3.5 w-3.5 text-zinc-600 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-zinc-800/60">
          {/* Args */}
          {Object.keys(part.args).length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">Arguments</div>
              <pre className="text-[11px] text-zinc-400 bg-zinc-950/60 rounded p-2 overflow-x-auto">
                {JSON.stringify(part.args, null, 2)}
              </pre>
            </div>
          )}
          {/* Result */}
          {part.result && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">Result</div>
              <pre className="text-[11px] text-zinc-300 bg-zinc-950/60 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {part.result}
              </pre>
            </div>
          )}
          {/* Error */}
          {part.error && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-400 mb-1">Error</div>
              <pre className="text-[11px] text-rose-300 bg-rose-950/20 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {part.error}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Inline result preview (when not expanded) */}
      {!expanded && part.result && (
        <div className="px-3 pb-2 -mt-0.5">
          <div className="text-[11px] text-zinc-500 line-clamp-2">{part.result}</div>
        </div>
      )}
      {!expanded && part.error && (
        <div className="px-3 pb-2 -mt-0.5">
          <div className="text-[11px] text-rose-400 line-clamp-1">{part.error}</div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default OracleBrain;
