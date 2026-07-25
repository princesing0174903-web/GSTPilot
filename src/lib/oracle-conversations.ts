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

// ─── PROMPT 5: Autonomous AI CFO types (additive) ─────────────────────────────

/** A finding from one of Oracle's internal specialist agents. */
export interface OracleAgentFinding {
  agent: 'cfo' | 'gst' | 'risk' | 'analyst' | 'collections' | 'forecast' | 'compliance'
  headline: string
  analysis: string
  severity: 'info' | 'watch' | 'warn' | 'critical'
  confidence: number
  evidence: string[]
}

/** A confidence tag for a conclusion. */
export interface OracleConfidenceTag {
  label: string
  confidence: number
  rationale: string
}

/** A single business score component. */
export interface OracleScoreComponent {
  key: string
  label: string
  score: number
  grade: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical'
  reason: string
}

/** Full business health scorecard. */
export interface OracleBusinessScorecard {
  revenue: OracleScoreComponent
  profitability: OracleScoreComponent
  liquidity: OracleScoreComponent
  compliance: OracleScoreComponent
  customerHealth: OracleScoreComponent
  risk: OracleScoreComponent
  growth: OracleScoreComponent
  overall: OracleScoreComponent
}

/** A timeline item. */
export interface OracleTimelineItem {
  bucket: 'today' | 'this_week' | 'this_month' | 'upcoming' | 'missed' | 'events'
  when: string
  title: string
  detail?: string
  severity?: 'info' | 'watch' | 'warn' | 'critical'
}

/** An autonomous proactive insight. */
export interface OracleInsight {
  id: string
  headline: string
  detail: string
  tone: 'positive' | 'negative' | 'warning' | 'opportunity'
  metric?: string
  actionPrompt?: string
}

/** A structured recommendation with explain-why. */
export interface OracleRecommendation {
  id: string
  title: string
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  reason: string
  impact: string
  estimatedOutcome: string
  actionPrompt?: string
}

/** A smart follow-up question. */
export interface OracleSmartFollowUp {
  id: string
  question: string
  rationale?: string
}

/** Live dashboard update payload. */
export interface OracleDashboardUpdate {
  healthScore: number
  healthLabel: string
  revenue: string
  receivables: string
  gstLiability: string
  cash: string
  riskScore: number
  priorities: { label: string; severity: 'info' | 'watch' | 'warn' | 'critical' }[]
  upcomingDeadlines: { label: string; when: string; severity: 'info' | 'watch' | 'warn' | 'critical' }[]
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
  /** Oracle-only (PROMPT 5): internal agent findings */
  agentFindings?: OracleAgentFinding[]
  /** Oracle-only (PROMPT 5): confidence tags */
  confidences?: OracleConfidenceTag[]
  /** Oracle-only (PROMPT 5): business scorecard */
  scorecard?: OracleBusinessScorecard | null
  /** Oracle-only (PROMPT 5): AI timeline items */
  timeline?: OracleTimelineItem[]
  /** Oracle-only (PROMPT 5): autonomous insights */
  insights?: OracleInsight[]
  /** Oracle-only (PROMPT 5): structured recommendations */
  recommendations?: OracleRecommendation[]
  /** Oracle-only (PROMPT 5): smart follow-up questions */
  smartFollowUps?: OracleSmartFollowUp[]
  /** Oracle-only (PROMPT 5): live dashboard update */
  dashboard?: OracleDashboardUpdate | null
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
  /** PROMPT 5: set internal agent findings. */
  setAgentFindings: (oracleTurnId: string, findings: OracleAgentFinding[]) => void
  /** PROMPT 5: set confidence tags. */
  setConfidences: (oracleTurnId: string, tags: OracleConfidenceTag[]) => void
  /** PROMPT 5: set business scorecard. */
  setScorecard: (oracleTurnId: string, scorecard: OracleBusinessScorecard | null) => void
  /** PROMPT 5: set AI timeline items. */
  setTimeline: (oracleTurnId: string, items: OracleTimelineItem[]) => void
  /** PROMPT 5: set autonomous insights. */
  setInsights: (oracleTurnId: string, insights: OracleInsight[]) => void
  /** PROMPT 5: set structured recommendations. */
  setRecommendations: (oracleTurnId: string, recs: OracleRecommendation[]) => void
  /** PROMPT 5: set smart follow-up questions. */
  setSmartFollowUps: (oracleTurnId: string, followUps: OracleSmartFollowUp[]) => void
  /** PROMPT 5: set live dashboard update. */
  setDashboard: (oracleTurnId: string, dashboard: OracleDashboardUpdate | null) => void
  setError: (oracleTurnId: string, errorMessage: string) => void
  finalizeMessage: (oracleTurnId: string) => void

  /**
   * Regenerate support: removes every turn AFTER the last user message (the old
   * Oracle answer), then appends a fresh empty streaming Oracle turn. Returns
   * the last user message content + the new oracle turn id so the caller can
   * stream into it. Returns null when there is no user message to regenerate.
   */
  regenerateLastOracleTurn: () => { userMessage: string; oracleTurnId: string } | null

  /**
   * Mark an in-flight Oracle turn as stopped (user pressed Stop). Clears the
   * streaming flag WITHOUT setting error styling. If the turn has no content,
   * a neutral placeholder is inserted so an empty bubble never lingers.
   */
  markStopped: (oracleTurnId: string) => void

  /**
   * Hydration cleanup: finalize any turn that was still streaming when the
   * page was closed/refreshed. Prevents infinite spinners after a reload.
   */
  finalizeAllStreaming: () => void

  // ── Derived conversation title from first user message ──
  ensureTitle: (conversationId: string, firstMessage: string) => void

  /**
   * Edit-previous-prompt support: removes the given turn AND every turn after
   * it from the active conversation. Used when the user clicks "Edit" on a
   * user message — the caller then refills the input with the old content.
   * When the user re-sends, it appends as a fresh message. Returns the content
   * of the removed user turn (so the caller can prefill the input), or null
   * if the turn wasn't found.
   */
  truncateFromTurn: (turnId: string) => string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(prefix = 'turn'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function deriveTitle(message: string): string {
  // Smart auto-titles: "GST Analysis – ABC Traders" instead of "New conversation".
  // Lazy import avoids circular deps and keeps the store bundle lean.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { generateSmartTitle } = require('./oracle/oracle-smart-titles') as typeof import('./oracle/oracle-smart-titles')
    const smart = generateSmartTitle(message)
    if (smart && smart !== 'New conversation') return smart
  } catch { /* fall through to basic truncation */ }
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

      setAgentFindings: (oracleTurnId, findings) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === oracleTurnId ? { ...m, agentFindings: findings } : m
                  ),
                }
              : c
          ),
        }))
      },

      setConfidences: (oracleTurnId, tags) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === oracleTurnId ? { ...m, confidences: tags } : m
                  ),
                }
              : c
          ),
        }))
      },

      setScorecard: (oracleTurnId, scorecard) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === oracleTurnId ? { ...m, scorecard } : m
                  ),
                }
              : c
          ),
        }))
      },

      setTimeline: (oracleTurnId, items) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === oracleTurnId ? { ...m, timeline: items } : m
                  ),
                }
              : c
          ),
        }))
      },

      setInsights: (oracleTurnId, insights) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === oracleTurnId ? { ...m, insights } : m
                  ),
                }
              : c
          ),
        }))
      },

      setRecommendations: (oracleTurnId, recs) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === oracleTurnId ? { ...m, recommendations: recs } : m
                  ),
                }
              : c
          ),
        }))
      },

      setSmartFollowUps: (oracleTurnId, followUps) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === oracleTurnId ? { ...m, smartFollowUps: followUps } : m
                  ),
                }
              : c
          ),
        }))
      },

      setDashboard: (oracleTurnId, dashboard) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === oracleTurnId ? { ...m, dashboard } : m
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

      regenerateLastOracleTurn: () => {
        const state = get()
        const activeId = state.activeId
        if (!activeId) return null
        const conv = state.conversations.find((c) => c.id === activeId)
        if (!conv) return null
        // Find the index of the last user message.
        let lastUserIdx = -1
        for (let i = conv.messages.length - 1; i >= 0; i--) {
          if (conv.messages[i].role === 'user') { lastUserIdx = i; break }
        }
        if (lastUserIdx === -1) return null
        const lastUser = conv.messages[lastUserIdx]
        // Keep everything up to and including the last user message; drop the
        // old Oracle answer that followed it.
        const kept = conv.messages.slice(0, lastUserIdx + 1)
        const oracleTurnId = uid('o')
        const now = nowISO()
        const oracleTurn: OracleTurn = {
          id: oracleTurnId,
          role: 'oracle',
          content: '',
          streaming: true,
          createdAt: now,
        }
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === activeId
              ? { ...c, messages: [...kept, oracleTurn], updatedAt: now }
              : c
          ),
        }))
        return { userMessage: lastUser.content, oracleTurnId }
      },

      markStopped: (oracleTurnId) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === oracleTurnId && m.role === 'oracle'
                      ? {
                          ...m,
                          streaming: false,
                          content:
                            m.content && m.content.trim().length > 0
                              ? m.content
                              : 'Generation stopped.',
                        }
                      : m
                  ),
                  updatedAt: nowISO(),
                }
              : c
          ),
        }))
      },

      finalizeAllStreaming: () => {
        set((s) => ({
          conversations: s.conversations.map((c) => {
            const hasStreaming = c.messages.some((m) => m.streaming)
            if (!hasStreaming) return c
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.streaming
                  ? {
                      ...m,
                      streaming: false,
                      content:
                        m.content && m.content.trim().length > 0
                          ? m.content
                          : 'This response was interrupted. Please try again.',
                    }
                  : m
              ),
            }
          }),
        }))
      },

      truncateFromTurn: (turnId) => {
        let removedContent: string | null = null
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== s.activeId) return c
            const idx = c.messages.findIndex((m) => m.id === turnId)
            if (idx === -1) return c
            removedContent = c.messages[idx].content
            return {
              ...c,
              messages: c.messages.slice(0, idx), // remove this turn + everything after
              updatedAt: nowISO(),
            }
          }),
        }))
        return removedContent
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
