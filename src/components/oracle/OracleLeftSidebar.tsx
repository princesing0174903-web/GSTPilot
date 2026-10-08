'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Left Sidebar — Premium conversation navigator (PROMPT 3)
//
// Sections (top → bottom):
//   • New Chat button (gold gradient)
//   • Search box (filters by title/message)
//   • Category chips: All · Business · GST · Compliance · Finance
//   • Pinned (if any)
//   • Folders: Today · Yesterday · Last Week · Last Month
//   • Per-row actions on hover: Pin/Unpin · Rename · Delete
//
// Responsive: rendered inline on lg+ screens; slides in as a drawer on mobile
// (the parent controls the `open`/`onClose` props for mobile).
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, MessageSquare, Trash2, Pin, PinOff, Pencil, X,
  Check, Building2, ShieldCheck, Receipt, Wallet, LayoutGrid, Sparkles,
} from 'lucide-react';
import {
  useOracleConversations,
  getConversationFolder,
  type Conversation,
  type ConversationCategory,
  type ConversationFolder,
} from '@/lib/oracle-conversations';

interface SidebarProps {
  /** Mobile drawer open state. On lg+ the sidebar is always visible. */
  open?: boolean;
  onClose?: () => void;
  /** Called after the user picks/creates a conversation (used to close mobile drawer). */
  onNavigate?: () => void;
}

const CATEGORY_CHIPS: { key: ConversationCategory | 'all'; label: string; icon: typeof Building2 }[] = [
  { key: 'all', label: 'All', icon: LayoutGrid },
  { key: 'business', label: 'Business', icon: Building2 },
  { key: 'gst', label: 'GST', icon: Receipt },
  { key: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { key: 'finance', label: 'Finance', icon: Wallet },
];

const FOLDER_LABELS: Record<ConversationFolder, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  lastWeek: 'Last Week',
  lastMonth: 'Last Month',
  older: 'Older',
};

const FOLDER_ORDER: ConversationFolder[] = ['today', 'yesterday', 'lastWeek', 'lastMonth', 'older'];

function ConversationRow({
  conv,
  isActive,
  onPick,
}: {
  conv: Conversation;
  isActive: boolean;
  onPick: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(conv.title);
  const togglePin = useOracleConversations((s) => s.togglePin);
  const deleteConversation = useOracleConversations((s) => s.deleteConversation);
  const renameConversation = useOracleConversations((s) => s.renameConversation);

  const commitRename = () => {
    const t = draft.trim();
    if (t) renameConversation(conv.id, t);
    setRenaming(false);
  };

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
        isActive
          ? 'bg-amber-500/[0.08] text-white ring-1 ring-inset ring-amber-500/20'
          : 'text-white/60 hover:bg-white/[0.04] hover:text-white'
      }`}
    >
      {renaming ? (
        <div className="flex w-full items-center gap-1.5">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenaming(false);
            }}
            onBlur={commitRename}
            className="min-w-0 flex-1 rounded bg-black/40 px-1.5 py-0.5 text-[13px] text-white outline-none ring-1 ring-amber-500/30"
          />
          <button
            onClick={(e) => { e.stopPropagation(); commitRename(); }}
            className="text-emerald-400 hover:text-emerald-300"
            aria-label="Save name"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <button onClick={onPick} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            {conv.pinned ? (
              <Pin className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            ) : (
              <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" />
            )}
            <span className="truncate">{conv.title || 'New conversation'}</span>
          </button>
          {/* Hover actions */}
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            <button
              onClick={(e) => { e.stopPropagation(); togglePin(conv.id); }}
              className="rounded p-1 text-white/40 hover:bg-white/5 hover:text-amber-400"
              aria-label={conv.pinned ? 'Unpin' : 'Pin'}
              title={conv.pinned ? 'Unpin' : 'Pin'}
            >
              {conv.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setRenaming(true); setDraft(conv.title); }}
              className="rounded p-1 text-white/40 hover:bg-white/5 hover:text-white"
              aria-label="Rename"
              title="Rename"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
              className="rounded p-1 text-white/40 hover:bg-white/5 hover:text-rose-400"
              aria-label="Delete"
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

export function OracleLeftSidebar({ open, onClose, onNavigate }: SidebarProps) {
  const conversations = useOracleConversations((s) => s.conversations);
  const activeId = useOracleConversations((s) => s.activeId);
  const setActive = useOracleConversations((s) => s.setActive);
  const createConversation = useOracleConversations((s) => s.createConversation);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ConversationCategory | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (category !== 'all' && (c.category ?? 'general') !== category) return false;
      if (!q) return true;
      const inTitle = c.title.toLowerCase().includes(q);
      const inMessages = c.messages.some((m) => m.content.toLowerCase().includes(q));
      return inTitle || inMessages;
    });
  }, [conversations, query, category]);

  const pinned = filtered.filter((c) => c.pinned);
  const unpinned = filtered.filter((c) => !c.pinned);

  const grouped = useMemo(() => {
    const map: Record<ConversationFolder, Conversation[]> = {
      today: [], yesterday: [], lastWeek: [], lastMonth: [], older: [],
    };
    for (const c of unpinned) {
      map[getConversationFolder(c.updatedAt || c.createdAt)].push(c);
    }
    return map;
  }, [unpinned]);

  const handleNew = () => {
    createConversation();
    onNavigate?.();
  };
  const handlePick = (id: string) => {
    setActive(id);
    onNavigate?.();
  };

  const content = (
    <div className="flex h-full flex-col bg-[#0A0A0A]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_16px_-2px_rgba(245,158,11,0.4)]">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">VEYRO AI</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-white/50 hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── New Chat ── */}
      <div className="px-3 pb-2">
        <button
          onClick={handleNew}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-2px_rgba(245,158,11,0.4)] transition hover:brightness-110 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" /> New Chat
        </button>
      </div>

      {/* ── Search ── */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg border border-[#1F1F1F] bg-[#111111] px-2.5 py-2 focus-within:border-amber-500/30">
          <Search className="h-3.5 w-3.5 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-white placeholder:text-white/35 focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-white/40 hover:text-white" aria-label="Clear search">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Category chips ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto px-3 pb-2 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORY_CHIPS.map((chip) => {
          const Icon = chip.icon;
          const isActive = category === chip.key;
          return (
            <button
              key={chip.key}
              onClick={() => setCategory(chip.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11.5px] font-medium transition ${
                isActive
                  ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
                  : 'bg-white/[0.03] text-white/55 ring-1 ring-white/5 hover:text-white'
              }`}
            >
              <Icon className="h-3 w-3" /> {chip.label}
            </button>
          );
        })}
      </div>

      {/* ── Conversation list ── */}
      <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {/* Pinned */}
        {pinned.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[10.5px] font-semibold uppercase tracking-wider text-amber-400/70">
              <Pin className="h-3 w-3" /> Pinned
            </p>
            <div className="space-y-0.5">
              {pinned.map((c) => (
                <ConversationRow
                  key={c.id}
                  conv={c}
                  isActive={c.id === activeId}
                  onPick={() => handlePick(c.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Folders */}
        {FOLDER_ORDER.map((folder) => {
          const items = grouped[folder];
          if (!items || items.length === 0) return null;
          return (
            <div key={folder}>
              <p className="mb-1.5 px-1 text-[10.5px] font-semibold uppercase tracking-wider text-white/35">
                {FOLDER_LABELS[folder]}
              </p>
              <div className="space-y-0.5">
                {items.map((c) => (
                  <ConversationRow
                    key={c.id}
                    conv={c}
                    isActive={c.id === activeId}
                    onPick={() => handlePick(c.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
              <MessageSquare className="h-5 w-5 text-white/30" />
            </div>
            <p className="text-[13px] font-medium text-white/50">
              {query ? 'No chats match your search' : 'No conversations yet'}
            </p>
            <p className="mt-1 text-[11px] text-white/35">
              {query ? 'Try a different keyword' : 'Start a new chat to begin'}
            </p>
          </div>
        )}
      </div>

      {/* ── Footer hint ── */}
      <div className="border-t border-[#1F1F1F] px-4 py-2.5">
        <p className="text-[10px] text-white/30">
          Oracle remembers your business context across all chats.
        </p>
      </div>
    </div>
  );

  // Desktop: always visible inline column.
  // Mobile: drawer controlled by `open`.
  return (
    <>
      {/* Desktop persistent column */}
      <aside className="hidden w-72 shrink-0 border-r border-[#1F1F1F] lg:block">
        {content}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 lg:hidden"
            onClick={onClose}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute left-0 top-0 h-full w-72 border-r border-[#1F1F1F]"
              onClick={(e) => e.stopPropagation()}
            >
              {content}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default OracleLeftSidebar;
