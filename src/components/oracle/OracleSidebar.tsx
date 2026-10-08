'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Left Sidebar (Memory + History)
//
// Two stacked sections:
//   1. Memory Panel — what Oracle knows (firm profile, connected services,
//      business facts, pinned insights).
//   2. Conversation History — auto-titled chats grouped by Today / Yesterday /
//      Previous 7 Days / Older, with a "New chat" button at the top.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Database,
  FileText,
  History,
  MessageSquarePlus,
  Pin,
  Plus,
  Trash2,
  Building2,
  Plug,
} from 'lucide-react';
import type { OracleConversation, UserMemory, BusinessMemory } from './oracle-types';
import {
  TIME_GROUP_LABELS,
  TIME_GROUP_ORDER,
  getTimeGroup,
  deleteConversation,
} from './oracle-storage';
import { cn } from '@/lib/utils';

export interface OracleSidebarProps {
  conversations: OracleConversation[];
  activeConversationId: string | null;
  userMemory: UserMemory;
  businessMemory: BusinessMemory;
  pinnedInsights: string[];
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onChanged: () => void;
}

export function OracleSidebar({
  conversations,
  activeConversationId,
  userMemory,
  businessMemory,
  pinnedInsights,
  onSelect,
  onNew,
  onDelete,
  onChanged,
}: OracleSidebarProps) {
  const [memoryOpen, setMemoryOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);

  const grouped = useMemo(() => {
    const g: Record<string, OracleConversation[]> = {
      today: [],
      yesterday: [],
      previous7: [],
      older: [],
    };
    for (const c of conversations) {
      g[getTimeGroup(c.updatedAt)].push(c);
    }
    // Each group is already newest-first because conversations list is sorted.
    return g;
  }, [conversations]);

  const handleDelete = (id: string) => {
    deleteConversation(id);
    onDelete(id);
    onChanged();
  };

  return (
    <aside className="glass-surface flex h-full w-full flex-col rounded-3xl">
      {/* Header: New chat */}
      <div className="p-3">
        <button
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-2xl accent-gradient px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-transform hover:scale-[1.01] active:scale-[0.99]"
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

      {/* Scrollable content */}
      <div className="custom-scrollbar flex-1 overflow-y-auto px-2 pb-2">
        {/* ─── Section: Memory ──────────────────────────────────────────────── */}
        <Section
          icon={Database}
          label="Memory"
          open={memoryOpen}
          onToggle={() => setMemoryOpen((v) => !v)}
        >
          {memoryOpen && <MemoryPanel userMemory={userMemory} businessMemory={businessMemory} pinnedInsights={pinnedInsights} />}
        </Section>

        {/* ─── Section: Conversation History ────────────────────────────────── */}
        <div className="mt-4">
          <SectionHeader
            icon={History}
            label="Conversation History"
            open={historyOpen}
            onToggle={() => setHistoryOpen((v) => !v)}
          />
          <AnimatePresence initial={false}>
            {historyOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-1 space-y-3 px-1">
                  {conversations.length === 0 ? (
                    <p className="px-2 py-3 text-[11px] text-muted-foreground">
                      No conversations yet. Start a new chat above.
                    </p>
                  ) : (
                    TIME_GROUP_ORDER.map((group) => {
                      const items = grouped[group];
                      if (items.length === 0) return null;
                      return (
                        <div key={group}>
                          <p className="px-2 pb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                            {TIME_GROUP_LABELS[group]}
                          </p>
                          <div className="space-y-0.5">
                            {items.map((c) => (
                              <ConversationItem
                                key={c.id}
                                conversation={c}
                                active={c.id === activeConversationId}
                                onSelect={() => onSelect(c.id)}
                                onDelete={() => handleDelete(c.id)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Brand identity footer — permanent attribution */}
      <div className="border-t border-border/50 px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-medium text-foreground/70">
              VEYRO Infinity™
            </p>
            <p className="truncate text-[9px] text-muted-foreground/60">
              The AI Operating System for Business
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50">
              Founder
            </p>
            <p className="text-[10px] font-semibold text-foreground/80">Prince Singh</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Section Wrapper ─────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  label,
  open,
  onToggle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <SectionHeader icon={Icon} label={label} open={open} onToggle={onToggle} />
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-1 px-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  label,
  open,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-card/[0.4]"
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {open ? (
        <ChevronDown className="h-3 w-3 text-muted-foreground/60" />
      ) : (
        <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
      )}
    </button>
  );
}

// ─── Memory Panel ────────────────────────────────────────────────────────────

function MemoryPanel({
  userMemory,
  businessMemory,
  pinnedInsights,
}: {
  userMemory: UserMemory;
  businessMemory: BusinessMemory;
  pinnedInsights: string[];
}) {
  return (
    <div className="space-y-3 pb-2">
      {/* Firm Profile */}
      <MemoryCard icon={Building2} title="Firm Profile">
        <MemoryRow label="Name" value={userMemory.firmName} />
        {userMemory.gstin && <MemoryRow label="GSTIN" value={userMemory.gstin} />}
        <MemoryRow label="Industry" value={userMemory.industry} />
        <MemoryRow label="Type" value={userMemory.businessType} />
        <MemoryRow label="Reporting" value={userMemory.reportingPreference} />
      </MemoryCard>

      {/* Connected Services */}
      <MemoryCard icon={Plug} title="Connected Services">
        <div className="flex flex-wrap gap-1.5">
          {userMemory.connectedServices.map((s) => (
            <span
              key={s}
              className="rounded-md border border-border bg-card/[0.4] px-1.5 py-0.5 text-[10px] font-medium text-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      </MemoryCard>

      {/* Business Facts */}
      <MemoryCard icon={Database} title="Business Facts">
        <MemoryRow label="Clients" value={`${businessMemory.clientCount} (${businessMemory.activeClients} active)`} />
        <MemoryRow label="Pending Returns" value={String(businessMemory.pendingReturns)} highlight={businessMemory.pendingReturns > 0} />
        <MemoryRow label="Overdue Returns" value={String(businessMemory.overdueReturns)} highlight={businessMemory.overdueReturns > 0} />
        <MemoryRow label="Invoices" value={String(businessMemory.totalInvoices)} />
        <MemoryRow
          label="Tax Volume"
          value={`₹${businessMemory.totalTaxVolume.toLocaleString('en-IN')}`}
        />
        <MemoryRow
          label="Avg Health"
          value={`${businessMemory.averageHealthScore}/100`}
          highlight={businessMemory.averageHealthScore < 70}
        />
        <MemoryRow
          label="Match Rate"
          value={`${businessMemory.matchPercentage}%`}
          highlight={businessMemory.matchPercentage < 95}
        />
      </MemoryCard>

      {/* Pinned Insights */}
      {pinnedInsights.length > 0 && (
        <MemoryCard icon={Pin} title="Pinned Insights">
          <ul className="space-y-1">
            {pinnedInsights.slice(0, 5).map((p, i) => (
              <li key={i} className="flex gap-1.5 text-[11px] text-foreground/80">
                <span className="accent-text">•</span>
                <span className="line-clamp-2">{p}</span>
              </li>
            ))}
          </ul>
        </MemoryCard>
      )}
    </div>
  );
}

function MemoryCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/[0.3] p-2.5">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className="h-3 w-3 accent-text" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function MemoryRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          'truncate font-medium',
          highlight ? 'text-amber-500' : 'text-foreground',
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Conversation Item ───────────────────────────────────────────────────────

function ConversationItem({
  conversation,
  active,
  onSelect,
  onDelete,
}: {
  conversation: OracleConversation;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors',
        active ? 'accent-gradient-soft' : 'hover:bg-card/[0.4]',
      )}
    >
      <button
        onClick={onSelect}
        className="min-w-0 flex-1 text-left"
      >
        <p
          className={cn(
            'truncate text-xs',
            active ? 'font-medium text-foreground' : 'text-foreground/80',
          )}
        >
          {conversation.title}
        </p>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Delete conversation"
        className="shrink-0 rounded p-0.5 text-muted-foreground/50 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// Suppress unused import warning for MessageSquarePlus (reserved for future quick-action).
void MessageSquarePlus;
void FileText;

export default OracleSidebar;
