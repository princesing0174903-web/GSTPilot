'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE CHAT — Streaming Hook
// ═══════════════════════════════════════════════════════════════════════════════
// Consumes the SSE stream from /api/oracle-chat and updates a Zustand store.
// Handles: conversation memory, tool-call animation, token streaming, and
// structured section assembly (Executive Summary / Analysis / Evidence /
// Recommended Actions / Confidence / Sources / Insights / Follow-ups).
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import type {
  ChatMessage, ToolCall, ToolResult, RecommendedAction, SourceRef,
  ProactiveInsight, OracleStreamEvent,
} from '@/lib/oracle-chat/types';

function uid(prefix = 'msg'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface OracleChatState {
  conversations: ChatMessage[][];
  conversationIds: string[];
  activeId: string | null;
  streaming: boolean;

  // Selectors
  getActiveMessages: () => ChatMessage[];

  // Lifecycle
  startConversation: () => string;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  clearAll: () => void;

  // Message ops
  pushUser: (text: string) => { conversationId: string; userMsgId: string; oracleMsgId: string };
  pushOraclePlaceholder: () => string;

  // Streaming updates
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
  /** Internal helper to patch a single oracle message in the active conversation */
  _updateOracle: (oracleId: string, updater: (m: ChatMessage) => ChatMessage) => void;
}

export const useOracleChat = create<OracleChatState>()((set, get) => ({
      conversations: [],
      conversationIds: [],
      activeId: null,
      streaming: false,

      getActiveMessages: () => {
        const { conversations, conversationIds, activeId } = get();
        if (!activeId) return [];
        const idx = conversationIds.indexOf(activeId);
        if (idx < 0) return [];
        return conversations[idx] ?? [];
      },

      startConversation: () => {
        const id = uid('conv');
        set((s) => ({
          conversations: [[]],
          conversationIds: [id],
          activeId: id,
        }));
        return id;
      },

      switchConversation: (id) => set({ activeId: id }),

      deleteConversation: (id) => {
        set((s) => {
          const idx = s.conversationIds.indexOf(id);
          if (idx < 0) return s;
          const conversationIds = s.conversationIds.filter((c) => c !== id);
          const conversations = s.conversations.filter((_, i) => i !== idx);
          const activeId = s.activeId === id ? (conversationIds[0] ?? null) : s.activeId;
          return { conversationIds, conversations, activeId };
        });
      },

      clearAll: () => set({ conversations: [], conversationIds: [], activeId: null, streaming: false }),

      pushUser: (text) => {
        let conversationId = get().activeId;
        if (!conversationId) {
          conversationId = get().startConversation();
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
        set((s) => {
          const idx = s.conversationIds.indexOf(conversationId!);
          if (idx < 0) return s;
          const conversations = [...s.conversations];
          conversations[idx] = [...conversations[idx], userMsg, oracleMsg];
          return { conversations };
        });
        return { conversationId: conversationId!, userMsgId: userMsg.id, oracleMsgId: oracleMsg.id };
      },

      pushOraclePlaceholder: () => {
        const id = uid('o');
        const msg: ChatMessage = {
          id,
          role: 'oracle',
          content: '',
          streaming: true,
          toolCalls: [],
          toolResults: [],
          createdAt: new Date().toISOString(),
        };
        return id;
      },

      _updateOracle: (oracleId: string, updater: (m: ChatMessage) => ChatMessage) => {
        set((s) => {
          const idx = s.conversationIds.indexOf(s.activeId!);
          if (idx < 0) return s;
          const conversations = [...s.conversations];
          conversations[idx] = conversations[idx].map((m) =>
            m.id === oracleId && m.role === 'oracle' ? updater(m) : m,
          );
          return { conversations };
        });
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
      },

      markError: (oracleId, msg) => {
        get()._updateOracle(oracleId, (m) => ({
          ...m,
          content: m.content || `⚠️ ${msg}`,
          streaming: false,
          error: true,
        }));
        set({ streaming: false });
      },

      setStreaming: (s) => set({ streaming: s }),
    }),
);

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
          handleStreamEvent(event, oracleMsgId);
        } catch {
          // ignore malformed events
        }
      }
    }

    // Process any remaining buffer
    if (buffer.startsWith('data: ')) {
      try {
        const event = JSON.parse(buffer.slice(6)) as OracleStreamEvent;
        handleStreamEvent(event, oracleMsgId);
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

function handleStreamEvent(event: OracleStreamEvent, oracleId: string) {
  const s = useOracleChat.getState();
  switch (event.type) {
    case 'conversation':
      // already set by caller
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

  let conversationId = store.activeId;
  if (!conversationId) {
    conversationId = store.startConversation();
  }
  const { oracleMsgId } = store.pushUser(trimmed);

  // Build history from current conversation (exclude the placeholder)
  const messages = useOracleChat.getState().getActiveMessages();
  const history = messages
    .filter((m) => m.id !== oracleMsgId && m.content)
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content }));

  await streamOracleChat(trimmed, history, conversationId, oracleMsgId);
}
