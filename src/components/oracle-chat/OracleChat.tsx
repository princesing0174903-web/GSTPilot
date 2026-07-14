'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE CHAT — Main Container (the AI CFO)
// ═══════════════════════════════════════════════════════════════════════════════
// Premium full-screen chat experience:
//   • Left: conversation history + new chat
//   • Center: messages + streaming input
//   • Right: proactive insights ("I noticed…")
//
// Oracle answers ONLY from real Prisma data. Never fabricates.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, MessageSquare, Trash2, Sparkles, Brain, ShieldCheck,
  PanelLeftClose, PanelLeft, X, Menu,
} from 'lucide-react';
import { useOracleChat, sendOracleMessage } from '@/hooks/useOracleChat';
import { UserMessage, OracleMessageView } from './Messages';
import { ChatInput } from './ChatInput';
import { ProactiveSidebar } from './ProactiveInsights';

// Stable empty array reference to avoid Zustand infinite re-render loops
const EMPTY_MESSAGES: readonly never[] = Object.freeze([]);

export function OracleChat() {
  // Select raw state slices (stable references) — never derive inside the selector
  const conversations = useOracleChat((s) => s.conversations);
  const conversationIds = useOracleChat((s) => s.conversationIds);
  const activeId = useOracleChat((s) => s.activeId);
  const streaming = useOracleChat((s) => s.streaming);
  const startConversation = useOracleChat((s) => s.startConversation);
  const switchConversation = useOracleChat((s) => s.switchConversation);
  const deleteConversation = useOracleChat((s) => s.deleteConversation);
  const clearAll = useOracleChat((s) => s.clearAll);

  // Derive the active conversation's messages with useMemo (stable reference)
  const messages = useMemo(() => {
    if (!activeId) return EMPTY_MESSAGES as any[];
    const idx = conversationIds.indexOf(activeId);
    if (idx < 0) return EMPTY_MESSAGES as any[];
    return conversations[idx] ?? (EMPTY_MESSAGES as any[]);
  }, [conversations, conversationIds, activeId]);

  // Derive conversation previews for the sidebar (stable per-preview)
  const previews = useMemo(() => {
    return conversationIds.map((id, idx) => {
      const msgs = conversations[idx] ?? [];
      const firstUser = msgs.find((m) => m.role === 'user');
      return {
        id,
        title: firstUser?.content?.slice(0, 36) || 'New conversation',
      };
    });
  }, [conversations, conversationIds]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMsgCount = useRef(0);

  // Auto-scroll ONLY when a new message is added (not on every streaming token)
  const msgCount = messages.length;
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
    startConversation();
    setMobileMenu(false);
  };

  const isEmpty = messages.length === 0;

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
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="relative z-10 hidden shrink-0 border-r border-white/10 bg-black/40 backdrop-blur-xl md:block"
          >
            <div className="flex h-full flex-col p-3">
              <button
                onClick={handleNewChat}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:from-emerald-300 hover:to-emerald-400"
              >
                <Plus className="h-4 w-4" />
                New Conversation
              </button>
              <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                History
              </div>
              <div className="flex-1 space-y-1 overflow-y-auto">
                {previews.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-zinc-600">No conversations yet</p>
                ) : (
                  previews.map((p) => (
                    <div
                      key={p.id}
                      className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                        p.id === activeId
                          ? 'bg-white/[0.06] text-zinc-100 ring-1 ring-inset ring-white/10'
                          : 'text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200'
                      }`}
                    >
                      <button
                        onClick={() => switchConversation(p.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        <span className="truncate">{p.title}</span>
                      </button>
                      <button
                        onClick={() => deleteConversation(p.id)}
                        className="opacity-0 transition group-hover:opacity-100"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-zinc-500 hover:text-rose-400" />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <button
                onClick={clearAll}
                className="mt-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-zinc-500 transition hover:bg-rose-400/10 hover:text-rose-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear all conversations
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main chat area */}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-white/10 bg-black/30 px-4 py-3 backdrop-blur-xl">
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
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {isEmpty ? (
            <WelcomeScreen onPick={handleSend} />
          ) : (
            <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
              {messages.map((m) =>
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

        {/* Input */}
        <div className="border-t border-white/10 bg-black/30 px-4 py-3 backdrop-blur-xl">
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
              className="fixed left-0 top-0 z-50 h-full w-72 border-r border-white/10 bg-zinc-950 p-3 md:hidden"
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
              <div className="space-y-1 overflow-y-auto">
                {previews.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      switchConversation(p.id);
                      setMobileMenu(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${
                      p.id === activeId ? 'bg-white/[0.06] text-zinc-100' : 'text-zinc-400 hover:bg-white/[0.03]'
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="truncate">{p.title}</span>
                  </button>
                ))}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
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
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-white">
          Oracle <span className="text-emerald-400">CFO</span>
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-zinc-400">
          Your AI Chief Financial Officer. I answer exclusively from your real business data —
          invoices, payments, GST, customers, vendors, bank, and more. Every insight is traceable
          to a source record.
        </p>
      </motion.div>

      <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
        {prompts.map((p, i) => (
          <motion.button
            key={p.text}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
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
