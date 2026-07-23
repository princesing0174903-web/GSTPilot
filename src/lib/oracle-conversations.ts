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

/** A data source Oracle read to answer a question (Sources Panel™). */
export interface OracleSource {
  key: string
  label: string
  recordCount: number
  connected: boolean
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

  // ── Message ops (operate on active conversation) ──
  pushUserMessage: (content: string) => { conversationId: string; userTurnId: string; oracleTurnId: string }
  appendDelta: (oracleTurnId: string, delta: string) => void
  setStreaming: (oracleTurnId: string, streaming: boolean) => void
  setFollowUps: (oracleTurnId: string, followUps: string[]) => void
  setSources: (oracleTurnId: string, sources: OracleSource[]) => void
  setStructured: (oracleTurnId: string, structured: StructuredQueryResult) => void
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
          conversations: s.conversations.map((c) =>
            c.id === conversationId &&
            (c.title === 'New conversation' || !c.title)
              ? { ...c, title: deriveTitle(firstMessage) }
              : c
          ),
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
