'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE CHAT — DB-Backed Streaming Hook
// ═══════════════════════════════════════════════════════════════════════════════
// Real database memory. Conversations are persisted to OracleAISession /
// OracleAIMessage via the /api/oracle-chat endpoints. A page refresh loads the
// full conversation history back from the database — nothing is lost.
//
// State model:
//   sessions: ConversationSummary[]  — from DB (sidebar list)
//   activeId: string | null          — currently-open conversation
//   activeMessages: ChatMessage[]    — messages for activeId (DB-loaded + streaming)
//   streaming: boolean               — is a response streaming in?
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import type {
  ChatMessage, ToolCall, ToolResult, RecommendedAction, SourceRef,
  ProactiveInsight, OracleStreamEvent, ConversationSummary,
} from '@/lib/oracle-chat/types';

function uid(prefix = 'msg'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface OracleChatState {
  // ─── DB-backed state ───
  sessions: ConversationSummary[];
  activeId: string | null;
  activeMessages: ChatMessage[];
  streaming: boolean;
  hydrated: boolean;

  // ─── Lifecycle ───
  hydrate: () => Promise<void>;
  newChat: () => void;
  switchConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  togglePin: (id: string, pinned: boolean) => Promise<void>;

  // ─── Message ops ───
  pushUserAndPlaceholder: (text: string) => { conversationId: string; oracleMsgId: string };

  // ─── Streaming updates ───
  setThinking: (oracleId: string, text: string) => void;
  addToolCall: (oracleId: string, tool: ToolCall) => void;
  addToolResult: (oracleId: string, result: ToolResult) => void;
  appendToken: (oracleId: string, token: string) => void;
  setSection: (oracleId: string, section: 'executiveSummary' | 'analysis' | 'evidence', text: string) => void;
  setActions: (oracleId: string, actions: RecommendedAction[]) => void;
  setConfidence: (oracleId: string, score: number) => void;
  setSources: (oracleId: string, sources: SourceRef[]) => void;
  setInsights: (oracleId: string, insights: ProactiveInsight[]) => void;
  setFollowUps: (oracleId: string, followUps: string[]) => void;
  finalize: (oracleId: string) => void;
  markError: (oracleId: string, msg: string) => void;
  setStreaming: (s: boolean) => void;
  refreshSessions: () => Promise<void>;
  _updateOracle: (oracleId: string, updater: (m: ChatMessage) => ChatMessage) => void;
}

export const useOracleChat = create<OracleChatState>()((set, get) => ({
  sessions: [],
  activeId: null,
  activeMessages: [],
  streaming: false,
  hydrated: false,

  // ─── Hydrate from DB on mount ───
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const res = await fetch('/api/oracle-chat/conversations', { cache: 'no-store' });
      if (res.ok) {
        const json = (await res.json()) as { conversations: ConversationSummary[] };
        set({ sessions: json.conversations ?? [], hydrated: true });
        // Auto-open the most recent conversation if any
        if (json.conversations?.length > 0 && !get().activeId) {
          await get().switchConversation(json.conversations[0].id);
        }
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },

  refreshSessions: async () => {
    try {
      const res = await fetch('/api/oracle-chat/conversations', { cache: 'no-store' });
      if (res.ok) {
        const json = (await res.json()) as { conversations: ConversationSummary[] };
        set({ sessions: json.conversations ?? [] });
      }
    } catch {
      /* ignore */
    }
  },

  newChat: () => {
    set({ activeId: null, activeMessages: [] });
  },

  switchConversation: async (id) => {
    if (get().activeId === id) return;
    set({ activeId: id, activeMessages: [] });
    try {
      const res = await fetch(`/api/oracle-chat/conversations/${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (res.ok) {
        const json = (await res.json()) as { messages: ChatMessage[] };
        set({ activeMessages: json.messages ?? [] });
      }
    } catch {
      /* ignore — leave empty */
    }
  },

  deleteConversation: async (id) => {
    try {
      await fetch(`/api/oracle-chat/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch { /* ignore */ }
    const wasActive = get().activeId === id;
    set((s) => ({ sessions: s.sessions.filter((c) => c.id !== id) }));
    if (wasActive) {
      const remaining = get().sessions;
      if (remaining.length > 0) {
        await get().switchConversation(remaining[0].id);
      } else {
        set({ activeId: null, activeMessages: [] });
      }
    }
  },

  renameConversation: async (id, title) => {
    try {
      await fetch(`/api/oracle-chat/conversations/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      set((s) => ({
        sessions: s.sessions.map((c) => (c.id === id ? { ...c, title } : c)),
      }));
    } catch { /* ignore */ }
  },

  togglePin: async (id, pinned) => {
    try {
      await fetch(`/api/oracle-chat/conversations/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned }),
      });
      set((s) => ({
        sessions: s.sessions.map((c) => (c.id === id ? { ...c, pinned } : c)),
      }));
    } catch { /* ignore */ }
  },

  // ─── Optimistic message insertion (the agent persists server-side) ───
  pushUserAndPlaceholder: (text) => {
    // Generate a conversation id if none active — the agent will create the DB row
    let conversationId = get().activeId;
    if (!conversationId) {
      conversationId = uid('sess');
    }
    const userMsg: ChatMessage = {
      id: uid('u'),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    const oracleMsg: ChatMessage = {
      id: uid('o'),
      role: 'oracle',
      content: '',
      streaming: true,
      toolCalls: [],
      toolResults: [],
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      activeId: conversationId!,
      activeMessages: [...s.activeMessages, userMsg, oracleMsg],
    }));
    return { conversationId: conversationId!, oracleMsgId: oracleMsg.id };
  },

  _updateOracle: (oracleId, updater) => {
    set((s) => ({
      activeMessages: s.activeMessages.map((m) =>
        m.id === oracleId && m.role === 'oracle' ? updater(m) : m,
      ),
    }));
  },

  setThinking: (oracleId, text) => {
    get()._updateOracle(oracleId, (m) => ({ ...m, content: m.content || text }));
  },

  addToolCall: (oracleId, tool) => {
    get()._updateOracle(oracleId, (m) => ({
      ...m,
      toolCalls: [...(m.toolCalls ?? []), tool],
    }));
  },

  addToolResult: (oracleId, result) => {
    get()._updateOracle(oracleId, (m) => ({
      ...m,
      toolResults: [...(m.toolResults ?? []), result],
    }));
  },

  appendToken: (oracleId, token) => {
    get()._updateOracle(oracleId, (m) => ({ ...m, content: m.content + token }));
  },

  setSection: (oracleId, section, text) => {
    get()._updateOracle(oracleId, (m) => ({ ...m, [section]: text }));
  },

  setActions: (oracleId, actions) => {
    get()._updateOracle(oracleId, (m) => ({ ...m, recommendedActions: actions }));
  },

  setConfidence: (oracleId, score) => {
    get()._updateOracle(oracleId, (m) => ({ ...m, confidence: score }));
  },

  setSources: (oracleId, sources) => {
    get()._updateOracle(oracleId, (m) => ({ ...m, sources }));
  },

  setInsights: (oracleId, insights) => {
    get()._updateOracle(oracleId, (m) => ({ ...m, insights }));
  },

  setFollowUps: (oracleId, followUps) => {
    get()._updateOracle(oracleId, (m) => ({ ...m, followUps }));
  },

  finalize: (oracleId) => {
    get()._updateOracle(oracleId, (m) => ({ ...m, streaming: false }));
    set({ streaming: false });
    // Refresh the sidebar so the new conversation + title appear
    void get().refreshSessions();
  },

  markError: (oracleId, msg) => {
    get()._updateOracle(oracleId, (m) => ({
      ...m,
      content: m.content || `⚠️ ${msg}`,
      streaming: false,
      error: true,
    }));
    set({ streaming: false });
    void get().refreshSessions();
  },

  setStreaming: (s) => set({ streaming: s }),
}));

// ─── Stream consumer ───────────────────────────────────────────────────────────

export async function streamOracleChat(
  message: string,
  history: { role: 'user' | 'oracle'; content: string }[],
  conversationId: string,
  oracleMsgId: string,
): Promise<void> {
  const store = useOracleChat.getState();
  store.setStreaming(true);

  try {
    const res = await fetch('/api/oracle-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, conversationId, history }),
    });

    if (!res.ok || !res.body) {
      store.markError(oracleMsgId, `Request failed (${res.status})`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by \n\n
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const raw of events) {
        const line = raw.trim();
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6);
        try {
          const event = JSON.parse(jsonStr) as OracleStreamEvent;
          handleStreamEvent(event, oracleMsgId, conversationId);
        } catch {
          // ignore malformed events
        }
      }
    }

    // Process any remaining buffer
    if (buffer.startsWith('data: ')) {
      try {
        const event = JSON.parse(buffer.slice(6)) as OracleStreamEvent;
        handleStreamEvent(event, oracleMsgId, conversationId);
      } catch {
        /* ignore */
      }
    }

    useOracleChat.getState().finalize(oracleMsgId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stream failed';
    useOracleChat.getState().markError(oracleMsgId, msg);
  }
}

function handleStreamEvent(event: OracleStreamEvent, oracleId: string, _conversationId: string) {
  const s = useOracleChat.getState();
  switch (event.type) {
    case 'conversation':
      // The agent may assign/confirm the conversation id — already set optimistically
      break;
    case 'thinking':
      s.setThinking(oracleId, event.text);
      break;
    case 'tool_call':
      s.addToolCall(oracleId, event.tool);
      break;
    case 'tool_result':
      s.addToolResult(oracleId, event.result);
      break;
    case 'token':
      s.appendToken(oracleId, event.text);
      break;
    case 'section':
      s.setSection(oracleId, event.section, event.text);
      break;
    case 'actions':
      s.setActions(oracleId, event.actions);
      break;
    case 'confidence':
      s.setConfidence(oracleId, event.score);
      break;
    case 'sources':
      s.setSources(oracleId, event.sources);
      break;
    case 'insights':
      s.setInsights(oracleId, event.insights);
      break;
    case 'followups':
      s.setFollowUps(oracleId, event.followUps);
      break;
    case 'done':
      s.finalize(oracleId);
      break;
    case 'error':
      s.markError(oracleId, event.message);
      break;
  }
}

// ─── Convenience: send a message end-to-end ────────────────────────────────────

export async function sendOracleMessage(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const store = useOracleChat.getState();
  if (store.streaming) return;

  const { conversationId, oracleMsgId } = store.pushUserAndPlaceholder(trimmed);

  // Build history from current active messages (exclude the placeholder)
  const messages = useOracleChat.getState().activeMessages;
  const history = messages
    .filter((m) => m.id !== oracleMsgId && m.content)
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content }));

  await streamOracleChat(trimmed, history, conversationId, oracleMsgId);
}
