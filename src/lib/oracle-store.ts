// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — V13 Workspace Store (Zustand)
//
// Manages the Perplexity-style full-screen Oracle workspace:
//   • `active`        — whether the workspace is open (replaces dashboard)
//   • `messages`      — conversation history (user Q + Oracle A pairs)
//   • `loading`       — whether Oracle is currently thinking
//   • `openWorkspace` — opens the workspace AND submits the first query
//   • `submitQuery`   — submits a follow-up question
//   • `closeWorkspace`— returns to the dashboard
//
// The store is UI-only. The actual LLM call happens in the component via
// /api/intelligence, which returns the structured Perplexity-style response.
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';

// ─── Types (mirrors /api/intelligence response) ──────────────────────────────

export type ActionType =
  | 'navigate'
  | 'create_task'
  | 'send_reminder'
  | 'generate_report'
  | 'execute_workflow';

export type InsightTone = 'positive' | 'neutral' | 'warning';

export interface OracleAction {
  type: ActionType;
  title: string;
  description: string;
  view?: string;
  payload?: Record<string, unknown>;
}

export interface OracleInsight {
  text: string;
  tone: InsightTone;
}

export interface OracleSource {
  name: string;
  count: number;
  icon?: string;
}

export interface ThinkingStep {
  label: string;
  duration: number;
}

export interface OracleMessage {
  id: string;
  role: 'user' | 'oracle';
  /** For user messages: the question. For oracle messages: the direct answer text. */
  content: string;
  /** Oracle-only fields (undefined for user messages) */
  thinkingSteps?: ThinkingStep[];
  insights?: OracleInsight[];
  sources?: OracleSource[];
  actions?: OracleAction[];
  suggestedPrompts?: string[];
  intent?: string;
  /** ISO timestamp */
  createdAt: string;
  /** Whether this oracle message is still loading (thinking steps playing) */
  isLoading?: boolean;
  /** Whether this oracle message errored */
  error?: boolean;
}

interface OracleStore {
  active: boolean;
  messages: OracleMessage[];
  loading: boolean;

  /** Open the workspace with an initial query (submits it immediately) */
  openWorkspace: (query: string) => void;
  /** Submit a follow-up query (workspace must already be open) */
  submitQuery: (query: string) => void;
  /** Internal: set loading state */
  setLoading: (loading: boolean) => void;
  /** Internal: append a user message */
  pushUserMessage: (query: string) => string;
  /** Internal: append an oracle placeholder (isLoading=true) and return its id */
  pushOraclePlaceholder: () => string;
  /** Internal: finalize an oracle message with the full structured response */
  finalizeOracleMessage: (
    id: string,
    response: {
      answer: string;
      insights: OracleInsight[];
      sources: OracleSource[];
      actions: OracleAction[];
      suggestedPrompts: string[];
      intent: string;
      thinkingSteps: ThinkingStep[];
    },
  ) => void;
  /** Internal: mark an oracle message as errored */
  errorOracleMessage: (id: string) => void;
  /** Close the workspace and clear conversation */
  closeWorkspace: () => void;
  /** Close workspace but keep history (for "new conversation" later) */
  newConversation: () => void;
}

function uid(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useOracleStore = create<OracleStore>((set, get) => ({
  active: false,
  messages: [],
  loading: false,

  openWorkspace: (query) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    // Reset conversation when opening fresh
    set({ active: true, messages: [], loading: true });
    get().pushUserMessage(trimmed);
    // The component will call submitQueryToApi which uses pushOraclePlaceholder + finalize
  },

  submitQuery: (query) => {
    const trimmed = query.trim();
    if (!trimmed || get().loading) return;
    set({ loading: true });
    get().pushUserMessage(trimmed);
  },

  setLoading: (loading) => set({ loading: loading }),

  pushUserMessage: (query) => {
    const id = uid();
    const msg: OracleMessage = {
      id,
      role: 'user',
      content: query,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, msg] }));
    return id;
  },

  pushOraclePlaceholder: () => {
    const id = uid();
    const msg: OracleMessage = {
      id,
      role: 'oracle',
      content: '',
      isLoading: true,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, msg] }));
    return id;
  },

  finalizeOracleMessage: (id, response) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id
          ? {
              ...m,
              content: response.answer,
              thinkingSteps: response.thinkingSteps,
              insights: response.insights,
              sources: response.sources,
              actions: response.actions,
              suggestedPrompts: response.suggestedPrompts,
              intent: response.intent,
              isLoading: false,
              error: false,
            }
          : m,
      ),
      loading: false,
    }));
  },

  errorOracleMessage: (id) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id
          ? {
              ...m,
              content:
                'I had trouble reaching my reasoning engine. Please try again.',
              isLoading: false,
              error: true,
              thinkingSteps: [],
              insights: [],
              sources: [],
              actions: [],
              suggestedPrompts: [
                'Show pending returns',
                'Which clients are risky?',
                'Predict next month revenue',
              ],
              intent: 'fallback',
            }
          : m,
      ),
      loading: false,
    }));
  },

  closeWorkspace: () => set({ active: false, messages: [], loading: false }),

  newConversation: () => set({ messages: [], loading: false }),
}));
