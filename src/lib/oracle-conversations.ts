// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Conversation Store
//
// Multi-conversation store backed by Zustand + localStorage persistence.
// Each conversation is a sequence of {role, content} messages with an id and
// created/updated timestamps. Follow-up suggestions are stored per-turn so
// they can be displayed under the answer even after a reload.
//
// The store is UI-only. Streaming happens in the OracleChat component, which
// calls `appendDelta` as tokens arrive and `finalizeMessage` once the stream
// closes.
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { StructuredQueryResult } from '@/lib/oracle/structured-query-types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'oracle'

/** Conversation category for the left sidebar filter chips. */
export type ConversationCategory =
  | 'business'
  | 'gst'
  | 'compliance'
  | 'finance'
  | 'general'

/** A data source Oracle read to answer a question (Sources Panel™). */
export interface OracleSource {
  key: string
  label: string
  recordCount: number
  connected: boolean
}

/** A KPI card computed deterministically from real Prisma data (PROMPT 4). */
export interface OracleMetricCard {
  key: string
  label: string
  value: string
  sub?: string
  trend?: 'up' | 'down' | 'flat'
  tone?: 'positive' | 'negative' | 'neutral' | 'warning'
}

/** An action button rendered beneath the answer (PROMPT 4). */
export interface OracleActionButton {
  id: string
  label: string
  icon: string
  prompt: string
  tone?: 'primary' | 'default'
}

/** A tool Oracle executed to gather real data (PROMPT 4). */
export interface OracleToolExecution {
  toolId: string
  label: string
  status: 'running' | 'done' | 'error'
  summary: string
  recordCount?: number
  durationMs?: number
}

export interface OracleTurn {
  id: string
  role: MessageRole
  content: string
  /** Oracle-only: suggested follow-up prompts shown beneath the answer */
  followUps?: string[]
  /** Oracle-only: data sources Oracle read (Sources Panel™) */
  sources?: OracleSource[]
  /** Oracle-only: structured data card (table/stats/chart) rendered above text */
  structured?: StructuredQueryResult
  /** Oracle-only (PROMPT 4): deterministic KPI cards from real data */
  metrics?: OracleMetricCard[]
  /** Oracle-only (PROMPT 4): action buttons */
  actions?: OracleActionButton[]
  /** Oracle-only (PROMPT 4): tools Oracle executed (trace) */
  toolTrace?: OracleToolExecution[]
  /** Oracle-only (PROMPT 4): classified intent */
  intent?: string
  /** Oracle-only: is the answer still streaming in? */
  streaming?: boolean
  /** Oracle-only: did the stream error? */
  error?: boolean
  createdAt: string
}

export interface Conversation {
  id: string
  title: string
  messages: OracleTurn[]
  createdAt: string
  updatedAt: string
  /** Pinned to the top of the sidebar. */
  pinned?: boolean
  /** Sidebar category filter chip. */
  category?: ConversationCategory
  /** Soft feedback recorded for the last Oracle answer. */
  lastFeedback?: 'like' | 'dislike'
}

interface OracleConversationsState {
  conversations: Conversation[]
  activeId: string | null

  // ── Selectors ──
  getActive: () => Conversation | null

  // ── Conversation lifecycle ──
  createConversation: () => string
  deleteConversation: (id: string) => void
  setActive: (id: string) => void
  renameConversation: (id: string, title: string) => void
  clearAll: () => void

  // ── Premium sidebar ops (additive) ──
  togglePin: (id: string) => void
  setCategory: (id: string, category: ConversationCategory) => void
  setFeedback: (id: string, feedback: 'like' | 'dislike') => void
  /** Infer a category from the user's question so the sidebar auto-sorts. */
  inferCategory: (text: string) => ConversationCategory

  // ── Message ops (operate on active conversation) ──
  pushUserMessage: (content: string) => { conversationId: string; userTurnId: string; oracleTurnId: string }
  appendDelta: (oracleTurnId: string, delta: string) => void
  setStreaming: (oracleTurnId: string, streaming: boolean) => void
  setFollowUps: (oracleTurnId: string, followUps: string[]) => void
  setSources: (oracleTurnId: string, sources: OracleSource[]) => void
  setStructured: (oracleTurnId: string, structured: StructuredQueryResult) => void
  /** PROMPT 4: set deterministic KPI cards (from real Prisma data). */
  setMetrics: (oracleTurnId: string, metrics: OracleMetricCard[]) => void
  /** PROMPT 4: set action buttons. */
  setActions: (oracleTurnId: string, actions: OracleActionButton[]) => void
  /** PROMPT 4: set the tool execution trace + intent. */
  setToolTrace: (oracleTurnId: string, trace: OracleToolExecution[], intent?: string) => void
  setError: (oracleTurnId: string, errorMessage: string) => void
  finalizeMessage: (oracleTurnId: string) => void

  // ── Derived conversation title from first user message ──
  ensureTitle: (conversationId: string, firstMessage: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(prefix = 'turn'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function deriveTitle(message: string): string {
  const clean = message.trim().replace(/\s+/g, ' ')
  if (clean.length <= 48) return clean
  return clean.slice(0, 45).trimEnd() + '…'
}

function nowISO(): string {
  return new Date().toISOString()
}

/** Standalone category inference (used before the store is hydrated). */
function inferCategoryFromText(text: string): ConversationCategory {
  const t = (text || '').toLowerCase()
  if (/\bgst\b|gstr|itc|input tax|output tax|return|filing|tax liability|tax credit/.test(t)) return 'gst'
  if (/invoice|customer|client|receivable|payable|vendor|payment|collection/.test(t)) return 'business'
  if (/compliance|notice|deadline|due date|penalty|audit|reconcil/.test(t)) return 'compliance'
  if (/cash|profit|revenue|expense|budget|flow|runway|forecast|p&l|balance sheet/.test(t)) return 'finance'
  return 'general'
}

/** Folder bucket for the sidebar date grouping (Today / Yesterday / Last Week / Last Month). */
export type ConversationFolder = 'today' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'older'

export function getConversationFolder(iso: string): ConversationFolder {
  const then = new Date(iso).getTime()
  if (isNaN(then)) return 'older'
  const now = Date.now()
  const dayMs = 86400000
  const diffDays = (now - then) / dayMs
  if (diffDays < 1) return 'today'
  if (diffDays < 2) return 'yesterday'
  if (diffDays < 7) return 'lastWeek'
  if (diffDays < 30) return 'lastMonth'
  return 'older'
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useOracleConversations = create<OracleConversationsState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,

      getActive: () => {
        const { conversations, activeId } = get()
        if (!activeId) return null
        return conversations.find((c) => c.id === activeId) || null
      },

      createConversation: () => {
        const id = uid('conv')
        const now = nowISO()
        const conv: Conversation = {
          id,
          title: 'New conversation',
          messages: [],
          createdAt: now,
          updatedAt: now,
        }
        set((s) => ({
          conversations: [conv, ...s.conversations],
          activeId: id,
        }))
        return id
      },

      deleteConversation: (id) => {
        set((s) => {
          const remaining = s.conversations.filter((c) => c.id !== id)
          const newActive =
            s.activeId === id ? remaining[0]?.id || null : s.activeId
          return { conversations: remaining, activeId: newActive }
        })
      },

      setActive: (id) => set({ activeId: id }),

      renameConversation: (id, title) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: nowISO() } : c
          ),
        }))
      },

      clearAll: () => set({ conversations: [], activeId: null }),

      togglePin: (id) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, pinned: !c.pinned } : c
          ),
        }))
      },

      setCategory: (id, category) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, category } : c
          ),
        }))
      },

      setFeedback: (id, feedback) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, lastFeedback: feedback } : c
          ),
        }))
      },

      inferCategory: (text) => {
        const t = (text || '').toLowerCase()
        if (/\bgst\b|gstr|itc|input tax|output tax|return|filing|tax liability|tax credit/.test(t)) return 'gst'
        if (/invoice|customer|client|receivable|payable|vendor|payment|collection/.test(t)) return 'business'
        if (/compliance|notice|deadline|due date|penalty|audit|reconcil/.test(t)) return 'compliance'
        if (/cash|profit|revenue|expense|budget|flow|runway|forecast|p&l|balance sheet/.test(t)) return 'finance'
        return 'general'
      },

      pushUserMessage: (content) => {
        // Ensure we have an active conversation
        let conversationId = get().activeId
        if (!conversationId) {
          conversationId = get().createConversation()
        }

        const userTurnId = uid('u')
        const oracleTurnId = uid('o')
        const now = nowISO()

        const userTurn: OracleTurn = {
          id: userTurnId,
          role: 'user',
          content,
          createdAt: now,
        }
        const oracleTurn: OracleTurn = {
          id: oracleTurnId,
          role: 'oracle',
          content: '',
          streaming: true,
          createdAt: now,
        }

        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: [...c.messages, userTurn, oracleTurn],
                  updatedAt: now,
                }
              : c
          ),
        }))

        return { conversationId: conversationId!, userTurnId, oracleTurnId }
      },

      appendDelta: (oracleTurnId, delta) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === oracleTurnId && m.role === 'oracle'
                      ? { ...m, content: m.content + delta }
                      : m
                  ),
                  updatedAt: nowISO(),
                }
              : c
          ),
        }))
      },

      setStreaming: (oracleTurnId, streaming) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === oracleTurnId ? { ...m, streaming } : m
                  ),
                }
              : c
          ),
        }))
      },

      setFollowUps: (oracleTurnId, followUps) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === oracleTurnId ? { ...m, followUps } : m
                  ),
                }
              : c
          ),
        }))
      },

      setSources: (oracleTurnId, sources) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === oracleTurnId ? { ...m, sources } : m
                  ),
                }
              : c
          ),
        }))
      },

      setStructured: (oracleTurnId, structured) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === oracleTurnId ? { ...m, structured } : m
                  ),
                }
              : c
          ),
        }))
      },

      setMetrics: (oracleTurnId, metrics) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === oracleTurnId ? { ...m, metrics } : m
                  ),
                }
              : c
          ),
        }))
      },

      setActions: (oracleTurnId, actions) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === oracleTurnId ? { ...m, actions } : m
                  ),
                }
              : c
          ),
        }))
      },

      setToolTrace: (oracleTurnId, trace, intent) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === oracleTurnId ? { ...m, toolTrace: trace, intent } : m
                  ),
                }
              : c
          ),
        }))
      },

      setError: (oracleTurnId, errorMessage) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === oracleTurnId
                      ? {
                          ...m,
                          content:
                            errorMessage ||
                            'I had trouble reaching my reasoning engine. Please try again.',
                          streaming: false,
                          error: true,
                        }
                      : m
                  ),
                }
              : c
          ),
        }))
      },

      finalizeMessage: (oracleTurnId) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === oracleTurnId
                      ? { ...m, streaming: false }
                      : m
                  ),
                  updatedAt: nowISO(),
                }
              : c
          ),
        }))
      },

      ensureTitle: (conversationId, firstMessage) => {
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c
            const shouldRetitle = c.title === 'New conversation' || !c.title
            const shouldCategorize = !c.category || c.category === 'general'
            if (!shouldRetitle && !shouldCategorize) return c
            return {
              ...c,
              title: shouldRetitle ? deriveTitle(firstMessage) : c.title,
              category: shouldCategorize ? inferCategoryFromText(firstMessage) : c.category,
            }
          }),
        }))
      },
    }),
    {
      name: 'gstpilot-oracle-conversations',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Only persist the conversations array + activeId, not methods
      partialize: (s) => ({ conversations: s.conversations, activeId: s.activeId }),
    }
  )
)
