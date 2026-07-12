// ═══════════════════════════════════════════════════════════════════════════════
// Oracle AI™ Intelligence Layer — Engine
//
// The engine orchestrates a chat turn end-to-end:
//   1. Load (or create) the session + agent persona
//   2. Persist the user message
//   3. Gather business context (oracle-core/context) — never throws
//   4. Pull relevant memory + knowledge entries (citations)
//   5. Compose the system prompt (agent persona + context + tool schemas)
//   6. Stream the LLM response via z-ai-web-dev-sdk (SSE to the client)
//   7. Detect & execute tool calls mid-stream (lightweight JSON protocol)
//   8. Persist artifacts produced by tools
//   9. Finalize the assistant message with parts (text, thinking, tool-calls,
//      citations, artifact-refs)
//  10. Update session stats (message count, tokens, lastMessageAt, summary)
//
// The streaming contract is documented in `src/components/oracle-ai/` and the
// API route `/api/oracle-ai/chat`. Events are SSE `data: <StreamEvent JSON>\n\n`.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  ArtifactData,
  ArtifactKind,
  ChatRequest,
  MessagePart,
  OracleAIAgent,
  OracleAIMessage,
  OracleAISession,
  StreamEvent,
  ToolExecutionResult,
} from './types';
import { ensureBuiltInAgents, getAgent, getDefaultAgent, recordAgentInvocation } from './agents';
import { executeTool, listRegisteredTools } from './tools';

const FIRM_ID = process.env.NEXT_PUBLIC_FIRM_ID || 'gstpilot-default-firm';
const DEFAULT_MODEL = process.env.ZAI_MODEL || 'glm-4.6';

// ─── Serialization helpers ───────────────────────────────────────────────────

function safeParseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function serializeSession(r: {
  id: string;
  firmId: string;
  userId: string | null;
  title: string;
  summary: string | null;
  status: string;
  agentId: string | null;
  modelUsed: string | null;
  messageCount: number;
  tokensUsed: number;
  metadata: string;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): OracleAISession {
  return {
    id: r.id,
    firmId: r.firmId,
    userId: r.userId,
    title: r.title,
    summary: r.summary,
    status: r.status as OracleAISession['status'],
    agentId: r.agentId,
    modelUsed: r.modelUsed,
    messageCount: r.messageCount,
    tokensUsed: r.tokensUsed,
    metadata: safeParseJSON<Record<string, unknown>>(r.metadata, {}) as OracleAISession['metadata'],
    lastMessageAt: r.lastMessageAt ? r.lastMessageAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function serializeMessage(r: {
  id: string;
  sessionId: string;
  firmId: string;
  userId: string | null;
  role: string;
  content: string;
  parts: string;
  model: string | null;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  status: string;
  error: string | null;
  agentId: string | null;
  toolName: string | null;
  parentMessageId: string | null;
  createdAt: Date;
}): OracleAIMessage {
  return {
    id: r.id,
    sessionId: r.sessionId,
    firmId: r.firmId,
    userId: r.userId,
    role: r.role as OracleAIMessage['role'],
    content: r.content,
    parts: safeParseJSON<MessagePart[]>(r.parts, []),
    model: r.model,
    tokensIn: r.tokensIn,
    tokensOut: r.tokensOut,
    latencyMs: r.latencyMs,
    status: r.status as OracleAIMessage['status'],
    error: r.error,
    agentId: r.agentId,
    toolName: r.toolName,
    parentMessageId: r.parentMessageId,
    createdAt: r.createdAt.toISOString(),
  };
}

// ─── Session management ──────────────────────────────────────────────────────

export async function createSession(input: {
  firmId?: string;
  userId?: string | null;
  title?: string;
  agentId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<OracleAISession> {
  const firmId = input.firmId || FIRM_ID;
  await ensureBuiltInAgents(firmId);
  let agentId = input.agentId ?? null;
  if (!agentId) {
    const def = await getDefaultAgent(firmId);
    agentId = def.id;
  }
  const row = await db.oracleAISession.create({
    data: {
      firmId,
      userId: input.userId ?? null,
      title: input.title || 'New conversation',
      status: 'active',
      agentId,
      metadata: JSON.stringify(input.metadata ?? {}),
    },
  });
  return serializeSession(row);
}

export async function getSession(sessionId: string, firmId: string = FIRM_ID): Promise<OracleAISession | null> {
  const row = await db.oracleAISession.findFirst({ where: { id: sessionId, firmId } });
  return row ? serializeSession(row) : null;
}

export async function listSessions(input: {
  firmId?: string;
  userId?: string | null;
  status?: 'active' | 'archived' | 'pinned' | 'deleted';
  limit?: number;
}): Promise<OracleAISession[]> {
  const firmId = input.firmId || FIRM_ID;
  const limit = Math.min(100, input.limit ?? 50);
  const where: { firmId: string; status?: string; userId?: string } = { firmId, status: input.status ?? 'active' };
  if (input.userId) where.userId = input.userId;
  const rows = await db.oracleAISession.findMany({
    where,
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: limit,
  });
  return rows.map(serializeSession);
}

export async function updateSession(
  sessionId: string,
  input: { title?: string; status?: 'active' | 'archived' | 'pinned' | 'deleted'; agentId?: string | null; summary?: string },
  firmId: string = FIRM_ID,
): Promise<OracleAISession | null> {
  const data: { title?: string; status?: string; agentId?: string | null; summary?: string } = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.status !== undefined) data.status = input.status;
  if (input.agentId !== undefined) data.agentId = input.agentId;
  if (input.summary !== undefined) data.summary = input.summary;
  const row = await db.oracleAISession.update({ where: { id: sessionId }, data }).catch(() => null);
  if (!row) return null;
  return serializeSession(row);
}

export async function deleteSession(sessionId: string, firmId: string = FIRM_ID): Promise<void> {
  await db.oracleAISession.updateMany({ where: { id: sessionId, firmId }, data: { status: 'deleted' } });
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function listMessages(sessionId: string, firmId: string = FIRM_ID): Promise<OracleAIMessage[]> {
  const rows = await db.oracleAIMessage.findMany({
    where: { sessionId, firmId },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  return rows.map(serializeMessage);
}

async function appendMessage(input: {
  sessionId: string;
  firmId: string;
  userId: string | null;
  role: OracleAIMessage['role'];
  content: string;
  parts?: MessagePart[];
  model?: string | null;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
  status?: OracleAIMessage['status'];
  agentId?: string | null;
  toolName?: string | null;
  parentMessageId?: string | null;
}): Promise<OracleAIMessage> {
  const row = await db.oracleAIMessage.create({
    data: {
      sessionId: input.sessionId,
      firmId: input.firmId,
      userId: input.userId,
      role: input.role,
      content: input.content,
      parts: JSON.stringify(input.parts ?? []),
      model: input.model ?? null,
      tokensIn: input.tokensIn ?? 0,
      tokensOut: input.tokensOut ?? 0,
      latencyMs: input.latencyMs ?? 0,
      status: input.status ?? 'completed',
      agentId: input.agentId ?? null,
      toolName: input.toolName ?? null,
      parentMessageId: input.parentMessageId ?? null,
    },
  });
  await db.oracleAISession.update({
    where: { id: input.sessionId },
    data: {
      messageCount: { increment: 1 },
      lastMessageAt: new Date(),
    },
  });
  return serializeMessage(row);
}

// ─── Artifacts ───────────────────────────────────────────────────────────────

export async function createArtifact(input: {
  sessionId: string;
  messageId?: string | null;
  firmId: string;
  userId?: string | null;
  kind: ArtifactKind;
  title: string;
  description?: string;
  data: ArtifactData;
}): Promise<string> {
  const row = await db.oracleAIArtifact.create({
    data: {
      sessionId: input.sessionId,
      messageId: input.messageId ?? null,
      firmId: input.firmId,
      userId: input.userId ?? null,
      kind: input.kind,
      title: input.title,
      description: input.description ?? null,
      data: JSON.stringify(input.data),
      rendered: true,
    },
  });
  return row.id;
}

export async function listArtifacts(sessionId: string, firmId: string = FIRM_ID): Promise<ReturnType<typeof serializeArtifact>[]> {
  const rows = await db.oracleAIArtifact.findMany({
    where: { sessionId, firmId },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map(serializeArtifact);
}

function serializeArtifact(r: {
  id: string;
  sessionId: string;
  messageId: string | null;
  firmId: string;
  userId: string | null;
  kind: string;
  title: string;
  description: string | null;
  data: string;
  rendered: boolean;
  pinned: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    sessionId: r.sessionId,
    messageId: r.messageId,
    firmId: r.firmId,
    userId: r.userId,
    kind: r.kind as ArtifactKind,
    title: r.title,
    description: r.description,
    data: safeParseJSON<ArtifactData>(r.data, {} as ArtifactData),
    rendered: r.rendered,
    pinned: r.pinned,
    version: r.version,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// ─── System prompt composition ───────────────────────────────────────────────

function buildToolSchemasBlock(): string {
  const tools = listRegisteredTools();
  if (tools.length === 0) return '';
  const lines = tools.map((t) => {
    const params = t.parameters
      .map((p) => `${p.name}${p.required ? '*' : ''}:${p.type}${p.enum ? `(${p.enum.join('|')})` : ''}`)
      .join(', ');
    return `- ${t.name}(${params}) — ${t.description}`;
  });
  return `\n## AVAILABLE TOOLS\nYou may call any of the following tools by emitting a JSON block on its own line, wrapped in <tool_call> tags:\n<tool_call>{"name":"tool_name","args":{"param":"value"}}</tool_call>\n${lines.join('\n')}\n`;
}

async function buildContextBlock(firmId: string): Promise<string> {
  try {
    const mod = await import('@/lib/oracle-core/context');
    const ctx = await mod.gatherBusinessContext(firmId);
    return mod.formatContextForPrompt(ctx);
  } catch {
    return '\n## BUSINESS CONTEXT\nContext engine unavailable — answer from general knowledge and flag that live data could not be loaded.\n';
  }
}

async function buildSystemPrompt(agent: OracleAIAgent, firmId: string): Promise<string> {
  const context = await buildContextBlock(firmId);
  const tools = buildToolSchemasBlock();
  return `${agent.systemPrompt}

## YOUR ROLE
You are ${agent.name}, the ${agent.role} of GSTPilot Infinity.

${context}

${tools}

## OUTPUT FORMAT
- Respond in clear markdown.
- Use tables, lists, and headers where they aid comprehension.
- When you produce structured data (a table, chart, report, metric), ALSO emit a <tool_call> to create-artifact so it renders as a rich artifact in the workspace.
- When you cite a source, emit a <tool_call> to record the citation OR include it as a markdown footnote.
- To call a tool, output exactly: <tool_call>{"name":"...","args":{...}}</tool_call> on its own line. The system will execute it and feed the result back.
- You may make multiple tool calls in one turn — emit each on its own line.
- After all tool calls complete, continue your prose answer.
- Never invent data. If a tool returns empty or error, say so plainly.
`;
}

// ─── Tool-call detection ─────────────────────────────────────────────────────

interface DetectedToolCall {
  callId: string;
  name: string;
  args: Record<string, unknown>;
}

const TOOL_CALL_RE = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/g;

function detectToolCalls(text: string): { cleaned: string; calls: DetectedToolCall[] } {
  const calls: DetectedToolCall[] = [];
  let match: RegExpExecArray | null;
  TOOL_CALL_RE.lastIndex = 0;
  while ((match = TOOL_CALL_RE.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]) as { name?: string; args?: Record<string, unknown> };
      if (parsed.name && typeof parsed.name === 'string') {
        calls.push({
          callId: `call_${calls.length + 1}_${Date.now().toString(36)}`,
          name: parsed.name,
          args: parsed.args ?? {},
        });
      }
    } catch {
      // skip malformed
    }
  }
  const cleaned = text.replace(TOOL_CALL_RE, '').trim();
  return { cleaned, calls };
}

// ─── Title generation ────────────────────────────────────────────────────────

function deriveTitle(message: string): string {
  const trimmed = message.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 60) return trimmed;
  return trimmed.slice(0, 57).trimEnd() + '…';
}

// ─── Streaming chat ──────────────────────────────────────────────────────────

/**
 * Run a chat turn and stream events to the client. Returns a ReadableStream
 * of SSE-formatted bytes.
 */
export async function streamChat(
  req: ChatRequest,
  ctx: { firmId?: string; userId?: string | null },
): Promise<ReadableStream<Uint8Array>> {
  const firmId = ctx.firmId || FIRM_ID;
  const userId = ctx.userId ?? null;
  const encoder = new TextEncoder();

  // Resolve session + agent
  const session = await getSession(req.sessionId, firmId);
  if (!session) {
    return errorStream(encoder, 'Session not found');
  }
  const agent = req.agentId ? await getAgent(req.agentId, firmId) : await getDefaultAgent(firmId);
  if (!agent) {
    return errorStream(encoder, 'No agent available');
  }

  // Persist the user message
  const userMessage = await appendMessage({
    sessionId: session.id,
    firmId,
    userId,
    role: 'user',
    content: req.message,
    parts: [{ kind: 'text', text: req.message }],
  });

  // Auto-title the session on first message
  if (session.messageCount === 0) {
    await updateSession(session.id, { title: deriveTitle(req.message) }, firmId);
  }

  // Build system prompt + message history
  const systemPrompt = await buildSystemPrompt(agent, firmId);
  const history = await listMessages(session.id, firmId);
  const modelMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-20).map((m) => ({
      role: m.role === 'user' ? 'user' as const : m.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: m.content || '(empty)',
    })),
  ];

  const model = req.model || agent.model || DEFAULT_MODEL;
  const start = Date.now();

  // Create the assistant message row (streaming status)
  const assistantMessage = await appendMessage({
    sessionId: session.id,
    firmId,
    userId,
    role: 'assistant',
    content: '',
    parts: [],
    model,
    status: 'streaming',
    agentId: agent.id,
  });

  // Update session agent + model
  await db.oracleAISession.update({
    where: { id: session.id },
    data: { agentId: agent.id, modelUsed: model },
  });

  const parts: MessagePart[] = [];
  let fullContent = '';
  const artifactsCreated: { kind: ArtifactKind; title: string; data: ArtifactData; artifactId: string }[] = [];
  const citations: { sourceId: string; title: string; url?: string; snippet?: string }[] = [];

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (ev: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      };

      emit({
        type: 'session',
        sessionId: session.id,
        agentId: agent.id,
        agentName: agent.name,
        model,
      });
      emit({ type: 'message-start', messageId: assistantMessage.id });

      // Emit a thinking event so the UI shows the reasoning state immediately
      emit({
        type: 'thinking',
        messageId: assistantMessage.id,
        label: `${agent.name} is thinking`,
        text: '',
      });

      try {
        // Stream the LLM
        const ZAIModule = await import('z-ai-web-dev-sdk');
        const ZAI = (ZAIModule as unknown as { default?: typeof import('z-ai-web-dev-sdk') }).default ?? ZAIModule;
        const zai = await ZAI.create();
        const completion = await zai.chat.completions.create({
          messages: modelMessages,
          model,
          stream: true,
          temperature: agent.temperature,
          max_tokens: 2000,
        } as Parameters<typeof zai.chat.completions.create>[0]);

        // Bridge the upstream stream — accumulate full content, then run tool calls
        const reader = (completion as unknown as ReadableStream<Uint8Array>).getReader
          ? (completion as unknown as ReadableStream<Uint8Array>).getReader()
          : null;

        if (reader) {
          const decoder = new TextDecoder();
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            // Parse SSE lines from upstream
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const payload = trimmed.slice(5).trim();
              if (payload === '[DONE]') continue;
              try {
                const parsed = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullContent += delta;
                  // Emit raw delta — tool-call tags will be cleaned client-side
                  emit({ type: 'text-delta', messageId: assistantMessage.id, delta });
                }
              } catch {
                // skip malformed chunk
              }
            }
          }
          // flush trailing buffer
          if (buffer.trim().startsWith('data:')) {
            const payload = buffer.trim().slice(5).trim();
            if (payload && payload !== '[DONE]') {
              try {
                const parsed = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullContent += delta;
                  emit({ type: 'text-delta', messageId: assistantMessage.id, delta });
                }
              } catch {
                // skip
              }
            }
          }
        } else {
          // Non-streaming fallback
          const fallback = completion as unknown as { choices?: { message?: { content?: string } }[] };
          const content = fallback?.choices?.[0]?.message?.content ?? '';
          fullContent = content;
          emit({ type: 'text-delta', messageId: assistantMessage.id, delta: content });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'LLM call failed';
        emit({ type: 'thinking', messageId: assistantMessage.id, label: 'Using offline reasoning', text: msg });
        // Fallback deterministic answer
        fullContent = `I encountered an issue reaching the model (${msg}). Here's what I can tell you from the gathered context:\n\nBased on the business context loaded, I can help you with this. Could you rephrase or try again in a moment?`;
        emit({ type: 'text-delta', messageId: assistantMessage.id, delta: fullContent });
      }

      // Detect & execute tool calls
      const { cleaned, calls } = detectToolCalls(fullContent);
      if (calls.length > 0) {
        for (const call of calls) {
          emit({
            type: 'tool-call',
            messageId: assistantMessage.id,
            callId: call.callId,
            toolName: call.name,
            args: call.args,
          });
          const result: ToolExecutionResult = await executeTool(call.name, call.args, {
            firmId,
            userId,
            sessionId: session.id,
            messageId: assistantMessage.id,
          });
          emit({
            type: 'tool-result',
            messageId: assistantMessage.id,
            callId: call.callId,
            toolName: call.name,
            ok: result.ok,
            result: result.result ?? null,
            error: result.error,
            durationMs: 0,
          });
          parts.push({
            kind: 'tool-call',
            toolName: call.name,
            args: call.args,
            callId: call.callId,
          });
          parts.push({
            kind: 'tool-result',
            callId: call.callId,
            toolName: call.name,
            ok: result.ok,
            result: result.result ?? null,
            durationMs: 0,
            error: result.error,
          });
          // Persist artifacts produced by the tool
          if (result.artifacts) {
            for (const a of result.artifacts) {
              const artifactId = await createArtifact({
                sessionId: session.id,
                messageId: assistantMessage.id,
                firmId,
                userId,
                kind: a.kind,
                title: a.title,
                data: a.data,
              });
              artifactsCreated.push({ kind: a.kind, title: a.title, data: a.data, artifactId });
              parts.push({
                kind: 'artifact-ref',
                artifactId,
                title: a.title,
                kind_hint: a.kind,
              });
              emit({
                type: 'artifact',
                messageId: assistantMessage.id,
                artifactId,
                kind: a.kind,
                title: a.title,
                data: a.data,
              });
            }
          }
          if (result.citations) {
            for (const c of result.citations) {
              const sourceId = `src_${citations.length + 1}`;
              citations.push({ sourceId, title: c.title, url: c.url, snippet: c.snippet });
              parts.push({
                kind: 'citation',
                sourceId,
                title: c.title,
                url: c.url,
                snippet: c.snippet,
                referenceNumber: c.referenceNumber,
              });
              emit({
                type: 'citation',
                messageId: assistantMessage.id,
                sourceId,
                title: c.title,
                url: c.url,
                snippet: c.snippet,
              });
            }
          }
        }
      }

      // Build the final content (cleaned of tool-call tags) + parts
      const finalContent = cleaned;
      parts.unshift({ kind: 'text', text: finalContent });

      const latencyMs = Date.now() - start;
      const tokensOut = Math.ceil(finalContent.length / 4);
      const tokensIn = Math.ceil(systemPrompt.length / 4) + Math.ceil(req.message.length / 4);

      // Finalize the assistant message
      await db.oracleAIMessage.update({
        where: { id: assistantMessage.id },
        data: {
          content: finalContent,
          parts: JSON.stringify(parts),
          status: 'completed',
          tokensIn,
          tokensOut,
          latencyMs,
        },
      });

      // Update session stats
      await db.oracleAISession.update({
        where: { id: session.id },
        data: {
          tokensUsed: { increment: tokensIn + tokensOut },
        },
      });

      // Generate a summary if this is the first turn
      if (session.messageCount === 0 && finalContent.length > 0) {
        const summary = finalContent.slice(0, 160).replace(/\n/g, ' ').trim();
        await updateSession(session.id, { summary }, firmId);
      }

      // Record agent invocation
      await recordAgentInvocation(agent.id);

      emit({
        type: 'usage',
        messageId: assistantMessage.id,
        tokensIn,
        tokensOut,
        latencyMs,
        model,
      });
      emit({
        type: 'message-end',
        messageId: assistantMessage.id,
        sessionId: session.id,
      });
      emit({ type: 'done' });
      controller.close();
    },
    cancel() {
      // Client disconnected — mark the message as cancelled
      void db.oracleAIMessage.update({
        where: { id: assistantMessage.id },
        data: { status: 'cancelled' },
      }).catch(() => {});
    },
  });
}

// ─── Error stream helper ─────────────────────────────────────────────────────

function errorStream(encoder: TextEncoder, message: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
      controller.close();
    },
  });
}

export const engineRuntime = { runtime: 'nodejs' as const };
