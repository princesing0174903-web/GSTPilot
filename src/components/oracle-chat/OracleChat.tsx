'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE CHAT — Main Container (the AI CFO / Financial CEO)
// ═══════════════════════════════════════════════════════════════════════════════
// Premium full-screen chat experience:
//   • Left: persisted conversation history (DB-backed) + new chat + pin/rename/delete
//   • Center: messages + streaming input (sticky footer)
//   • Right: proactive insights ("I noticed…")
//
// Oracle answers ONLY from real Prisma data. Never fabricates. Conversations are
// persisted to OracleAISession / OracleAIMessage — a page refresh restores the
// full history. Real database memory, not browser memory.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, MessageSquare, Trash2, Sparkles, Brain, ShieldCheck,
  PanelLeftClose, PanelLeft, X, Menu, Pin, PinOff, Pencil, Check,
  ArrowLeft, Search,
} from 'lucide-react';
import { useOracleChat, sendOracleMessage } from '@/hooks/useOracleChat';
import { UserMessage, OracleMessageView } from './Messages';
import { ChatInput } from './ChatInput';
import { ProactiveSidebar } from './ProactiveInsights';

export function OracleChat() {
  const router = useRouter();
  const sessions = useOracleChat((s) => s.sessions);
  const activeId = useOracleChat((s) => s.activeId);
  const activeMessages = useOracleChat((s) => s.activeMessages);
  const streaming = useOracleChat((s) => s.streaming);
  const hydrated = useOracleChat((s) => s.hydrated);
  const hydrate = useOracleChat((s) => s.hydrate);
  const newChat = useOracleChat((s) => s.newChat);
  const switchConversation = useOracleChat((s) => s.switchConversation);
  const deleteConversation = useOracleChat((s) => s.deleteConversation);
  const renameConversation = useOracleChat((s) => s.renameConversation);
  const togglePin = useOracleChat((s) => s.togglePin);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMsgCount = useRef(0);

  const handleBackToDashboard = () => {
    router.push('/');
  };

  // Hydrate conversations from DB on mount
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Auto-scroll ONLY when a new message is added (not on every streaming token)
  const msgCount = activeMessages.length;
  useEffect(() => {
    if (msgCount !== prevMsgCount.current) {
      prevMsgCount.current = msgCount;
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [msgCount]);

  const handleSend = async (text: string) => {
    await sendOracleMessage(text);
  };

  const handleNewChat = () => {
    newChat();
    setMobileMenu(false);
  };

  const handleSwitch = (id: string) => {
    void switchConversation(id);
    setMobileMenu(false);
  };

  const handleDelete = (id: string) => {
    void deleteConversation(id);
  };

  const startRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditValue(currentTitle);
  };

  const commitRename = (id: string) => {
    const v = editValue.trim();
    if (v) void renameConversation(id, v);
    setEditingId(null);
    setEditValue('');
  };

  // Sort: pinned first, then by updatedAt desc. Apply search filter when present.
  const { pinnedSessions, recentSessions } = useMemo(() => {
    const filtered = searchQuery.trim()
      ? sessions.filter((s) =>
          (s.title || 'New conversation').toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : sessions;
    const sorted = [...filtered].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return {
      pinnedSessions: sorted.filter((s) => s.pinned),
      recentSessions: sorted.filter((s) => !s.pinned),
    };
  }, [sessions, searchQuery]);

  // Combined list for mobile drawer (keeps existing render code simple)
  const sortedSessions = useMemo(
    () => [...pinnedSessions, ...recentSessions],
    [pinnedSessions, recentSessions],
  );

  const isEmpty = activeMessages.length === 0;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-emerald-500/[0.07] blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-teal-500/[0.05] blur-3xl" />
      </div>

      {/* Desktop Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 288, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="relative z-10 hidden shrink-0 border-r border-white/10 bg-black/40 backdrop-blur-xl md:block"
          >
            <div className="flex h-full flex-col p-3">
              {/* Back to Dashboard — closes Oracle workspace */}
              <button
                onClick={handleBackToDashboard}
                className="mb-3 flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Dashboard
              </button>

              {/* New Conversation */}
              <button
                onClick={handleNewChat}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:from-emerald-300 hover:to-emerald-400"
              >
                <Plus className="h-4 w-4" />
                New Conversation
              </button>

              {/* Search */}
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations…"
                  className="w-full rounded-lg border border-white/10 bg-black/40 py-1.5 pl-8 pr-2.5 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none transition focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/30"
                />
              </div>

              {/* Conversation list: Pinned + History sections */}
              <div className="flex-1 space-y-3 overflow-y-auto oracle-scroll">
                {sortedSessions.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-zinc-600">
                    {hydrated
                      ? searchQuery.trim()
                        ? 'No matches'
                        : 'No conversations yet'
                      : 'Loading…'}
                  </p>
                ) : (
                  <>
                    {pinnedSessions.length > 0 && (
                      <div>
                        <div className="mb-1 flex items-center justify-between px-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                            Pinned
                          </span>
                          <span className="text-[10px] text-zinc-600">{pinnedSessions.length}</span>
                        </div>
                        <div className="space-y-1">
                          {pinnedSessions.map((p) => (
                            <ConversationRow
                              key={p.id}
                              p={p}
                              activeId={activeId}
                              editingId={editingId}
                              editValue={editValue}
                              onSwitch={handleSwitch}
                              onDelete={handleDelete}
                              onPin={togglePin}
                              onRename={startRename}
                              onCommitRename={commitRename}
                              onEditChange={setEditValue}
                              onCancelEdit={() => { setEditingId(null); setEditValue(''); }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="mb-1 flex items-center justify-between px-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                          History
                        </span>
                        <div className="flex items-center gap-1.5">
                          {hydrated && (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400/70">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              Saved
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-600">{recentSessions.length}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {recentSessions.map((p) => (
                          <ConversationRow
                            key={p.id}
                            p={p}
                            activeId={activeId}
                            editingId={editingId}
                            editValue={editValue}
                            onSwitch={handleSwitch}
                            onDelete={handleDelete}
                            onPin={togglePin}
                            onRename={startRename}
                            onCommitRename={commitRename}
                            onEditChange={setEditValue}
                            onCancelEdit={() => { setEditingId(null); setEditValue(''); }}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-white/[0.02] px-2.5 py-2 text-[11px] text-zinc-500 ring-1 ring-inset ring-white/5">
                <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-400/70" />
                <span>Persisted to your database · never fabricated</span>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main chat area */}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-black/30 px-4 py-3 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="hidden rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200 md:block"
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setMobileMenu(true)}
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400/20 to-emerald-500/5 ring-1 ring-emerald-400/30">
              <Brain className="h-5 w-5 text-emerald-300" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-zinc-950" />
            </div>
            <div>
              <h1 className="flex items-center gap-1.5 text-base font-semibold leading-tight text-white">
                Oracle
                <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                  AI CFO
                </span>
              </h1>
              <p className="text-[11px] leading-tight text-zinc-500">
                {streaming ? 'Thinking…' : 'Ready · Grounded in real data'}
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-400 ring-1 ring-inset ring-white/10 sm:flex">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              No fabrication
            </div>
            <button
              onClick={() => setInsightsOpen((o) => !o)}
              className="hidden rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200 lg:block"
              title="Toggle insights"
            >
              <Sparkles className="h-4 w-4" />
            </button>
            {/* Back to Dashboard — visible in the header on mobile when sidebar is hidden */}
            <button
              onClick={handleBackToDashboard}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.06] hover:text-white md:hidden"
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto oracle-scroll">
          {isEmpty ? (
            <WelcomeScreen onPick={handleSend} />
          ) : (
            <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
              {activeMessages.map((m) =>
                m.role === 'user' ? (
                  <UserMessage key={m.id} message={m} />
                ) : (
                  <OracleMessageView key={m.id} message={m} onFollowUp={handleSend} />
                ),
              )}
              <div ref={bottomRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Sticky input footer */}
        <div className="shrink-0 border-t border-white/10 bg-black/30 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto max-w-3xl">
            <ChatInput onSend={handleSend} streaming={streaming} compact={!isEmpty} />
          </div>
        </div>
      </main>

      {/* Right insights panel (desktop) */}
      <AnimatePresence>
        {insightsOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="relative z-10 hidden shrink-0 border-l border-white/10 bg-black/40 backdrop-blur-xl lg:block"
          >
            <div className="h-full p-3">
              <ProactiveSidebar />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile menu drawer */}
      <AnimatePresence>
        {mobileMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenu(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-white/10 bg-zinc-950 p-3 md:hidden"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Conversations</span>
                <button onClick={() => setMobileMenu(false)} className="rounded-lg p-1 text-zinc-400 hover:bg-white/5">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={handleNewChat}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black"
              >
                <Plus className="h-4 w-4" />
                New Conversation
              </button>
              <div className="flex-1 space-y-1 overflow-y-auto oracle-scroll">
                {sortedSessions.map((p) => (
                  <div
                    key={p.id}
                    className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${
                      p.id === activeId ? 'bg-white/[0.06] text-zinc-100' : 'text-zinc-400 hover:bg-white/[0.03]'
                    }`}
                  >
                    <button
                      onClick={() => handleSwitch(p.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      {p.pinned ? (
                        <Pin className="h-3 w-3 shrink-0 text-amber-400/80" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      )}
                      <span className="truncate">{p.title || 'New conversation'}</span>
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="shrink-0 text-zinc-500 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Conversation row (shared between desktop sidebar + mobile drawer) ─────────

interface ConversationRowProps {
  p: { id: string; title: string; pinned: boolean; updatedAt: string };
  activeId: string | null;
  editingId: string | null;
  editValue: string;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onRename: (id: string, currentTitle: string) => void;
  onCommitRename: (id: string) => void;
  onEditChange: (v: string) => void;
  onCancelEdit: () => void;
}

function ConversationRow({
  p, activeId, editingId, editValue,
  onSwitch, onDelete, onPin, onRename, onCommitRename, onEditChange, onCancelEdit,
}: ConversationRowProps) {
  const isEditing = editingId === p.id;
  return (
    <div
      className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
        p.id === activeId
          ? 'bg-white/[0.06] text-zinc-100 ring-1 ring-inset ring-white/10'
          : 'text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200'
      }`}
    >
      {isEditing ? (
        <>
          <input
            autoFocus
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitRename(p.id);
              if (e.key === 'Escape') onCancelEdit();
            }}
            className="min-w-0 flex-1 rounded bg-black/40 px-1.5 py-0.5 text-sm text-zinc-100 outline-none ring-1 ring-emerald-400/40"
          />
          <button onClick={() => onCommitRename(p.id)} className="text-emerald-400 hover:text-emerald-300">
            <Check className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <>
          {p.pinned ? (
            <Pin className="h-3 w-3 shrink-0 text-amber-400/80" />
          ) : (
            <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
          )}
          <button
            onClick={() => onSwitch(p.id)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <span className="truncate">{p.title || 'New conversation'}</span>
          </button>
          <div className="flex items-center opacity-0 transition group-hover:opacity-100">
            <button
              onClick={() => onPin(p.id, !p.pinned)}
              className="rounded p-1 text-zinc-500 hover:text-amber-300"
              title={p.pinned ? 'Unpin' : 'Pin'}
            >
              {p.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
            </button>
            <button
              onClick={() => onRename(p.id, p.title)}
              className="rounded p-1 text-zinc-500 hover:text-zinc-200"
              title="Rename"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => onDelete(p.id)}
              className="rounded p-1 text-zinc-500 hover:text-rose-400"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Welcome / empty state ─────────────────────────────────────────────────────

function WelcomeScreen({ onPick }: { onPick: (q: string) => void }) {
  const prompts = [
    { icon: '💰', text: 'How much money am I expecting?', desc: 'Outstanding receivables & overdue' },
    { icon: '📞', text: 'Which customers need follow-up?', desc: 'Open invoices & contact details' },
    { icon: '📅', text: 'What happened this week?', desc: 'Executive briefing from timeline' },
    { icon: '🧾', text: 'How much GST will I pay?', desc: 'Output tax − ITC calculation' },
    { icon: '🏦', text: "What's my cash position?", desc: 'Bank balance, burn, runway' },
    { icon: '👥', text: 'Should I hire more employees?', desc: 'Revenue vs payroll analysis' },
    { icon: '📉', text: 'Why did revenue fall?', desc: 'Root-cause from real records' },
    { icon: '🔮', text: 'Predict next month GST', desc: 'Trend-based projection' },
    { icon: '⚖️', text: 'Compare June vs July', desc: 'Month-over-month deltas' },
  ];
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mb-6 flex flex-col items-center text-center"
      >
        <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400/20 to-emerald-500/5 ring-1 ring-emerald-400/30">
          <Brain className="h-10 w-10 text-emerald-300" />
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-400 ring-4 ring-zinc-950"
          />
        </div>
        <h1 className="mb-1 text-4xl font-bold tracking-tight text-white">
          Oracle
        </h1>
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-emerald-400/80">
          The Financial Brain of India
        </p>
        <p className="max-w-md text-sm leading-relaxed text-zinc-400">
          Your AI Chief Financial Officer. I answer exclusively from your real business data —
          invoices, payments, GST, customers, vendors, bank, and more. Every insight is traceable
          to a source record, and every conversation is saved to your database.
        </p>
      </motion.div>

      <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {prompts.map((p, i) => (
          <motion.button
            key={p.text}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.04 }}
            onClick={() => onPick(p.text)}
            className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition hover:border-emerald-400/30 hover:bg-emerald-400/[0.04]"
          >
            <span className="text-xl">{p.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-100">{p.text}</p>
              <p className="text-[12px] text-zinc-500">{p.desc}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
