'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Oracle™ & AI CFO™ — useOracle() Hook
//
// Conversational Q&A with the GSTPilot Oracle. Maintains a local in-memory
// `messages` array (user + assistant messages in order). The orchestrator
// persists the conversation to `ai_memory` server-side, so this hook does NOT
// write to Firestore directly — it just keeps the live chat state.
//
// Flow:
//   1. `ask(question)` appends a user ChatMessage immediately.
//   2. Sets loading=true.
//   3. POST /api/ai/oracle/chat with { organizationId, question }.
//   4. On success: appends an assistant ChatMessage with the answer + metadata.
//      Returns the ChatResponse.
//   5. On error: appends an assistant ChatMessage with a graceful fallback
//      ("I couldn't process that right now…"), sets error, returns null.
//   6. `clear()` resets messages to [].
//
// Mirrors useBanking.ts structure (useOrg for orgId, useCallback for ask/clear,
// null-safe when orgId is null — ask() returns null gracefully).
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import type { ChatMessage, ChatResponse } from '@/lib/ai-provider';

// ─── Hook return type ──────────────────────────────────────────────────────

export interface UseOracleResult {
  /** In-memory chat history (user + assistant messages, in order). */
  messages: ChatMessage[];
  /** True while a request to /api/ai/oracle/chat is in-flight. */
  loading: boolean;
  /** Error string from the last failed ask() call, or null. */
  error: string | null;
  /** Ask the Oracle a question. Returns the ChatResponse on success, null on error. */
  ask: (question: string) => Promise<ChatResponse | null>;
  /** Reset the local chat history to []. */
  clear: () => void;
}

// Graceful fallback shown to the user when the Oracle request fails.
const FALLBACK_ANSWER =
  "I couldn't process that right now. Please check your connection and try again — I'm here to help once your data is available.";

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useOracle(): UseOracleResult {
  const { organization } = useOrg();
  const orgId = organization?.id ?? null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Mutation: ask ───────────────────────────────────────────────────────

  const ask = useCallback(
    async (question: string): Promise<ChatResponse | null> => {
      const trimmed = question.trim();
      if (!trimmed) return null;

      // Append the user message immediately for responsive UX.
      const userMsg: ChatMessage = {
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // No org → respond gracefully with a fallback assistant message.
      if (!orgId) {
        const fallback: ChatMessage = {
          role: 'assistant',
          content: FALLBACK_ANSWER,
          timestamp: new Date().toISOString(),
          metadata: { sources: [], confidence: 'low', dataUsed: null },
        };
        setMessages((prev) => [...prev, fallback]);
        setError('No organization selected.');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/ai/oracle/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: orgId, question: trimmed }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Oracle request failed.');
        }
        const response = data.response as ChatResponse;
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: response.answer,
          timestamp: new Date().toISOString(),
          metadata: {
            sources: response.sources ?? [],
            confidence: response.confidence ?? 'medium',
            dataUsed: response.dataUsed ?? null,
            relatedInsights: response.relatedInsights ?? [],
            relatedRecommendations: response.relatedRecommendations ?? [],
          },
        };
        setMessages((prev) => [...prev, assistantMsg]);
        return response;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        const fallback: ChatMessage = {
          role: 'assistant',
          content: FALLBACK_ANSWER,
          timestamp: new Date().toISOString(),
          metadata: { sources: [], confidence: 'low', dataUsed: null, error: msg },
        };
        setMessages((prev) => [...prev, fallback]);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  // ─── Mutation: clear ─────────────────────────────────────────────────────

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    loading,
    error,
    ask,
    clear,
  };
}
