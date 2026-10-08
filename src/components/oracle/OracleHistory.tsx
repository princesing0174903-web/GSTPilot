'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Conversation History Sidebar
//
// Collapsible 264px sidebar. "+ New conversation" button at top, then a list of
// past conversations (title + relative time + message count). Click to load,
// hover to reveal delete. Active conversation is highlighted with mint accent.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  MessageSquare,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Search,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useOracleConversations } from '@/lib/oracle-conversations';
import { cn } from '@/lib/utils';

interface OracleHistoryProps {
  collapsed: boolean;
  onToggle: () => void;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  // Same year — show DD/MM
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${d}/${m}`;
}

export function OracleHistory({ collapsed, onToggle }: OracleHistoryProps) {
  const conversations = useOracleConversations((s) => s.conversations);
  const activeId = useOracleConversations((s) => s.activeId);
  const createConversation = useOracleConversations((s) => s.createConversation);
  const deleteConversation = useOracleConversations((s) => s.deleteConversation);
  const setActive = useOracleConversations((s) => s.setActive);
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.toLowerCase();
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [conversations, query]);

  // ── Collapsed: render a thin rail with a toggle + new-chat ──
  if (collapsed) {
    return (
      <aside className="flex h-full w-14 shrink-0 flex-col items-center gap-2 border-r border-white/[0.06] bg-black/20 py-3">
        <button
          onClick={onToggle}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <div className="my-1 h-px w-6 bg-white/[0.06]" />
        <button
          onClick={() => createConversation()}
          className="flex h-9 w-9 items-center justify-center rounded-lg accent-gradient-soft text-[#3B82F6] transition-all hover:scale-105 hover:text-[#3B82F6]"
          aria-label="New conversation"
          title="New conversation"
        >
          <Plus className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col border-r border-white/[0.06] bg-black/20">
      {/* ── Header: brand + collapse ── */}
      <div className="flex h-14 shrink-0 items-center gap-2 px-3">
        <button
          onClick={() => {
            // Clicking the brand starts a new conversation if none active
            if (!activeId) createConversation();
          }}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-white/[0.04]"
          title="VEYRO AI™"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md accent-gradient-soft border border-[#3B82F6]/20">
            <Sparkles className="h-3.5 w-3.5 text-[#3B82F6]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">
              Oracle<span className="accent-text">™</span>
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {conversations.length} {conversations.length === 1 ? 'thread' : 'threads'}
            </p>
          </div>
        </button>
        <button
          onClick={onToggle}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* ── New conversation ── */}
      <div className="px-3 pb-2">
        <button
          onClick={() => createConversation()}
          className="flex w-full items-center gap-2 rounded-lg border border-[#3B82F6]/25 bg-[#3B82F6]/[0.06] px-3 py-2 text-sm font-medium text-foreground transition-all hover:border-[#3B82F6]/40 hover:bg-[#3B82F6]/[0.1]"
        >
          <Plus className="h-4 w-4 text-[#3B82F6]" />
          New conversation
        </button>
      </div>

      {/* ── Search ── */}
      {conversations.length > 0 && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search threads…"
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] py-1.5 pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-[#3B82F6]/30 focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/20"
            />
          </div>
        </div>
      )}

      {/* ── Conversation list ── */}
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-2 pb-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <MessageSquare className="mb-2 h-6 w-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              {query ? 'No matching threads' : 'No conversations yet'}
            </p>
            {!query && (
              <p className="mt-1 text-[11px] text-muted-foreground/70">
                Start by asking Oracle anything.
              </p>
            )}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((conv) => {
              const isActive = conv.id === activeId;
              const messageCount = conv.messages.filter((m) => m.role === 'user').length;
              return (
                <li key={conv.id}>
                  <div
                    data-active={isActive}
                    className={cn(
                      'oracle-history-item group relative flex cursor-pointer items-start gap-2 rounded-lg border border-transparent px-2.5 py-2',
                      isActive && 'border-[#3B82F6]/20'
                    )}
                    onClick={() => setActive(conv.id)}
                  >
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
                      {isActive ? (
                        <div className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/60" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'truncate text-xs font-medium',
                          isActive ? 'text-foreground' : 'text-foreground/85'
                        )}
                      >
                        {conv.title}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatRelativeTime(conv.updatedAt)} · {messageCount}{' '}
                        {messageCount === 1 ? 'msg' : 'msgs'}
                      </p>
                    </div>

                    {/* Delete on hover */}
                    <AnimatePresence>
                      {confirmDelete === conv.id ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md border border-red-500/30 bg-[#0a0a0e] p-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              deleteConversation(conv.id);
                              setConfirmDelete(null);
                            }}
                            className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-red-400 hover:bg-red-500/15"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-white/[0.06]"
                          >
                            Cancel
                          </button>
                        </motion.div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(conv.id);
                          }}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-red-500/15 hover:text-red-400 group-hover:opacity-100"
                          aria-label="Delete conversation"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </AnimatePresence>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Footer hint ── */}
      <div className="shrink-0 border-t border-white/[0.06] px-3 py-2.5">
        <p className="text-[10px] leading-relaxed text-muted-foreground/70">
          Oracle never says "I don't have enough data." It always helps with GST,
          finance, and compliance questions.
        </p>
      </div>
    </aside>
  );
}

export default OracleHistory;
