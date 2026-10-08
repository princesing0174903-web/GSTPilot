'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Streaming chat hook
//
// Consumes the SSE stream from /api/oracle-ai/chat and exposes:
//   • messages:        the full message list (loaded + live)
//   • streaming:       true while a turn is in flight
//   • thinking:        the current thinking label (or null)
//   • streamingText:   the in-progress assistant text delta
//   • sendMessage():   enqueue a new user message + stream the response
//   • stop():          abort the current stream
//   • artifacts:       artifacts produced during the current/last turn
//   • toolCalls:       tool calls + results during the current/last turn
//   • citations:       citations surfaced during the current/last turn
//   • error:           last error (if any)
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from '@/lib/firebase';
import type {
  ArtifactData,
  ArtifactKind,
  MessagePart,
  OracleAIMessage,
  StreamEvent,
} from '@/lib/oracle-ai/types';

interface UseOracleAIChatOptions {
  sessionId: string | null;
  onArtifactsChange?: (artifacts: LiveArtifact[]) => void;
  onTaskActivity?: () => void;
}

export interface LiveArtifact {
  artifactId: string;
  kind: ArtifactKind;
  title: string;
  data: ArtifactData;
  messageId: string;
}

export interface LiveToolCall {
  callId: string;
  toolName: string;
  args: Record<string, unknown>;
  ok: boolean | null;
  result: unknown;
  error?: string;
  durationMs: number;
  messageId: string;
}

export interface LiveCitation {
  sourceId: string;
  title: string;
  url?: string;
  snippet?: string;
  referenceNumber?: string;
  messageId: string;
}

async function getIdToken(): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken(false);
  } catch {
    return null;
  }
}

function buildAuthHeaders(token: string | null, json = true): Record<string, string> {
  const h: Record<string, string> = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export function useOracleAIChat({ sessionId, onArtifactsChange, onTaskActivity }: UseOracleAIChatOptions) {
  const [messages, setMessages] = useState<OracleAIMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [thinking, setThinking] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<LiveArtifact[]>([]);
  const [toolCalls, setToolCalls] = useState<LiveToolCall[]>([]);
  const [citations, setCitations] = useState<LiveCitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const onArtifactsRef = useRef(onArtifactsChange);
  const onTaskActivityRef = useRef(onTaskActivity);
  onArtifactsRef.current = onArtifactsChange;
  onTaskActivityRef.current = onTaskActivity;

  // ─── Load history when sessionId changes ──────────────────────────────────
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingHistory(true);
    (async () => {
      try {
        const token = await getIdToken();
        const res = await fetch(`/api/oracle-ai/sessions/${sessionId}/messages`, {
          headers: buildAuthHeaders(token, false),
        });
        if (!res.ok) throw new Error(`Failed to load messages: ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setMessages(data.messages ?? []);
          // Hydrate artifacts from message parts
          const arts: LiveArtifact[] = [];
          for (const m of data.messages ?? []) {
            for (const p of (m.parts ?? []) as MessagePart[]) {
              if (p.kind === 'artifact-ref') {
                // We don't have the full data in the ref — fetch artifacts list
              }
            }
          }
          // Fetch artifacts for this session
          try {
            const artsRes = await fetch(`/api/oracle-ai/artifacts?sessionId=${sessionId}`, {
              headers: buildAuthHeaders(token, false),
            });
            if (artsRes.ok) {
              const artsData = await artsRes.json();
              const restored: LiveArtifact[] = (artsData.artifacts ?? []).map((a: { id: string; kind: ArtifactKind; title: string; data: ArtifactData; messageId: string | null }) => ({
                artifactId: a.id,
                kind: a.kind,
                title: a.title,
                data: a.data,
                messageId: a.messageId ?? '',
              }));
              if (!cancelled) {
                setArtifacts(restored);
                onArtifactsRef.current?.(restored);
              }
            }
          } catch {
            // non-fatal
          }
          void arts;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load history');
        }
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // ─── Send a message ────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string, opts?: { agentId?: string; model?: string }) => {
      if (!sessionId || !text.trim() || streaming) return;
      setError(null);
      setThinking('Preparing…');
      setStreamingText('');
      setStreaming(true);
      setArtifacts([]);
      setToolCalls([]);
      setCitations([]);

      // Optimistic user message
      const userMsg: OracleAIMessage = {
        id: `optim-user-${Date.now()}`,
        sessionId,
        firmId: '',
        userId: null,
        role: 'user',
        content: text,
        parts: [{ kind: 'text', text }],
        model: null,
        tokensIn: 0,
        tokensOut: 0,
        latencyMs: 0,
        status: 'completed',
        error: null,
        agentId: opts?.agentId ?? null,
        toolName: null,
        parentMessageId: null,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const token = await getIdToken();
        const res = await fetch('/api/oracle-ai/chat', {
          method: 'POST',
          headers: buildAuthHeaders(token),
          body: JSON.stringify({
            sessionId,
            message: text,
            agentId: opts?.agentId,
            model: opts?.model,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error ?? `Chat failed: ${res.status}`);
        }
        if (!res.body) throw new Error('No response body');

        // Parse SSE stream
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let liveArtifacts: LiveArtifact[] = [];
        let liveToolCalls: LiveToolCall[] = [];
        let liveCitations: LiveCitation[] = [];
        let assistantMessageId: string | null = null;
        let liveText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload) continue;
            let ev: StreamEvent;
            try {
              ev = JSON.parse(payload) as StreamEvent;
            } catch {
              continue;
            }
            switch (ev.type) {
              case 'message-start': {
                assistantMessageId = (ev.messageId as string) ?? null;
                setStreamingMessageId(assistantMessageId);
                setThinking(`${ev.agentName ?? 'Oracle'} is thinking`);
                break;
              }
              case 'thinking': {
                setThinking((ev.label as string) ?? 'Thinking…');
                break;
              }
              case 'text-delta': {
                liveText += (ev.delta as string) ?? '';
                setStreamingText(liveText);
                setThinking(null);
                break;
              }
              case 'tool-call': {
                const tc: LiveToolCall = {
                  callId: (ev.callId as string) ?? '',
                  toolName: (ev.toolName as string) ?? '',
                  args: (ev.args as Record<string, unknown>) ?? {},
                  ok: null,
                  result: null,
                  durationMs: 0,
                  messageId: (ev.messageId as string) ?? '',
                };
                liveToolCalls = [...liveToolCalls, tc];
                setToolCalls(liveToolCalls);
                onTaskActivityRef.current?.();
                break;
              }
              case 'tool-result': {
                liveToolCalls = liveToolCalls.map((t) =>
                  t.callId === (ev.callId as string)
                    ? {
                        ...t,
                        ok: (ev.ok as boolean) ?? false,
                        result: ev.result ?? null,
                        error: ev.error as string | undefined,
                        durationMs: (ev.durationMs as number) ?? 0,
                      }
                    : t,
                );
                setToolCalls(liveToolCalls);
                break;
              }
              case 'artifact': {
                const a: LiveArtifact = {
                  artifactId: (ev.artifactId as string) ?? '',
                  kind: (ev.kind as ArtifactKind) ?? 'table',
                  title: (ev.title as string) ?? 'Artifact',
                  data: (ev.data as ArtifactData) ?? {},
                  messageId: (ev.messageId as string) ?? '',
                };
                liveArtifacts = [...liveArtifacts, a];
                setArtifacts(liveArtifacts);
                onArtifactsRef.current?.(liveArtifacts);
                break;
              }
              case 'citation': {
                const c: LiveCitation = {
                  sourceId: (ev.sourceId as string) ?? '',
                  title: (ev.title as string) ?? '',
                  url: ev.url as string | undefined,
                  snippet: ev.snippet as string | undefined,
                  referenceNumber: ev.referenceNumber as string | undefined,
                  messageId: (ev.messageId as string) ?? '',
                };
                liveCitations = [...liveCitations, c];
                setCitations(liveCitations);
                break;
              }
              case 'usage': {
                // Could surface token usage in UI; for now ignored.
                break;
              }
              case 'message-end': {
                // Finalize: replace optimistic assistant text with the full message
                setThinking(null);
                setStreamingText('');
                if (assistantMessageId) {
                  const finalMsg: OracleAIMessage = {
                    id: assistantMessageId,
                    sessionId,
                    firmId: '',
                    userId: null,
                    role: 'assistant',
                    content: liveText,
                    parts: [],
                    model: (ev.model as string) ?? null,
                    tokensIn: 0,
                    tokensOut: 0,
                    latencyMs: 0,
                    status: 'completed',
                    error: null,
                    agentId: null,
                    toolName: null,
                    parentMessageId: null,
                    createdAt: new Date().toISOString(),
                  };
                  setMessages((prev) => [...prev, finalMsg]);
                }
                break;
              }
              case 'error': {
                setError((ev.message as string) ?? 'Unknown error');
                break;
              }
              case 'done': {
                break;
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          // user cancelled — not an error
        } else {
          setError(err instanceof Error ? err.message : 'Chat failed');
        }
      } finally {
        setStreaming(false);
        setThinking(null);
        setStreamingMessageId(null);
        abortRef.current = null;
      }
    },
    [sessionId, streaming],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    messages,
    streaming,
    thinking,
    streamingText,
    streamingMessageId,
    artifacts,
    toolCalls,
    citations,
    error,
    loadingHistory,
    sendMessage,
    stop,
  };
}
