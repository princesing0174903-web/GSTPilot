// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE CHAT — Database Persistence Layer
// ═══════════════════════════════════════════════════════════════════════════════
// Real database memory. Conversations, messages, tool-call audits, and semantic
// memory records are persisted to Prisma — NOT browser memory. A page refresh
// loads the full conversation history back from OracleAISession / OracleAIMessage.
//
// Single-tenant note: VEYRO AI Chat surface has no auth gate (the page mounts
// directly). All persistence is scoped to DEFAULT_FIRM_ID. The schema supports
// multi-tenant (firmId + userId are indexed); the wiring defaults to one tenant
// for this preview. Every row is REAL Prisma data — never fabricated.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  ChatMessage, ConversationSummary, MessagePart, RecommendedAction,
  SourceRef, ToolCall, ToolResult, ProactiveInsight,
} from './types';

export const DEFAULT_FIRM_ID = 'firm_default';

// ─── Sessions ──────────────────────────────────────────────────────────────────

export interface CreateSessionInput {
  id?: string;
  title?: string;
}

/** Create a new OracleAISession row. Idempotent on id (uses upsert). */
export async function createSession(input: CreateSessionInput = {}): Promise<string> {
  const id = input.id || genId('sess');
  await db.oracleAISession.upsert({
    where: { id },
    create: {
      id,
      firmId: DEFAULT_FIRM_ID,
      userId: null,
      title: input.title || 'New conversation',
      status: 'active',
      messageCount: 0,
      tokensUsed: 0,
      metadata: '{}',
    },
    update: {}, // no-op if already exists
  });
  return id;
}

/** List all active (non-deleted) sessions, newest first. */
export async function listSessions(): Promise<ConversationSummary[]> {
  const rows = await db.oracleAISession.findMany({
    where: { firmId: DEFAULT_FIRM_ID, status: { not: 'deleted' } },
    orderBy: [{ updatedAt: 'desc' }],
    take: 100,
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    status: r.status,
    messageCount: r.messageCount,
    pinned: parseMeta(r.metadata).pinned === true,
    lastMessageAt: r.lastMessageAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** Load a single session with all its messages, oldest first. */
export async function loadSession(sessionId: string): Promise<{
  session: ConversationSummary | null;
  messages: ChatMessage[];
}> {
  const [sess, rows] = await Promise.all([
    db.oracleAISession.findUnique({ where: { id: sessionId } }),
    db.oracleAIMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    }),
  ]);
  if (!sess) return { session: null, messages: [] };
  const session: ConversationSummary = {
    id: sess.id,
    title: sess.title,
    summary: sess.summary,
    status: sess.status,
    messageCount: sess.messageCount,
    pinned: parseMeta(sess.metadata).pinned === true,
    lastMessageAt: sess.lastMessageAt?.toISOString() ?? null,
    createdAt: sess.createdAt.toISOString(),
    updatedAt: sess.updatedAt.toISOString(),
  };
  const messages: ChatMessage[] = rows.map((r) => dbRowToChatMessage(r));
  return { session, messages };
}

/** Rename a session. */
export async function renameSession(sessionId: string, title: string): Promise<void> {
  await db.oracleAISession.update({
    where: { id: sessionId },
    data: { title: title.slice(0, 200) },
  });
}

/** Toggle pinned state. */
export async function setPinned(sessionId: string, pinned: boolean): Promise<void> {
  const sess = await db.oracleAISession.findUnique({ where: { id: sessionId } });
  const meta = parseMeta(sess?.metadata);
  meta.pinned = pinned;
  await db.oracleAISession.update({
    where: { id: sessionId },
    data: { metadata: JSON.stringify(meta) },
  });
}

/** Soft-delete (status = deleted) so the row is preserved for audit. */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.oracleAISession.update({
    where: { id: sessionId },
    data: { status: 'deleted' },
  });
}

// ─── Messages ──────────────────────────────────────────────────────────────────

/** Persist a user message. Returns the DB row id. */
export async function persistUserMessage(sessionId: string, content: string): Promise<string> {
  const id = genId('msg');
  await db.oracleAIMessage.create({
    data: {
      id,
      sessionId,
      firmId: DEFAULT_FIRM_ID,
      userId: null,
      role: 'user',
      content,
      parts: '[]',
      status: 'completed',
    },
  });
  await touchSession(sessionId, content);
  return id;
}

/** Persist an oracle (assistant) message with full structured parts. */
export async function persistOracleMessage(
  sessionId: string,
  data: {
    content: string;
    executiveSummary?: string;
    analysis?: string;
    evidence?: string;
    recommendedActions?: RecommendedAction[];
    confidence?: number;
    sources?: SourceRef[];
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
    insights?: ProactiveInsight[];
    followUps?: string[];
    latencyMs?: number;
    error?: string | null;
  },
): Promise<string> {
  const id = genId('msg');
  const parts: MessagePart[] = [];
  if (data.executiveSummary) parts.push({ kind: 'section', data: { which: 'executive_summary', text: data.executiveSummary } });
  if (data.analysis) parts.push({ kind: 'section', data: { which: 'analysis', text: data.analysis } });
  if (data.evidence) parts.push({ kind: 'section', data: { which: 'evidence', text: data.evidence } });
  if (data.toolCalls?.length) parts.push({ kind: 'tool_call', data: data.toolCalls });
  if (data.toolResults?.length) parts.push({ kind: 'tool_result', data: data.toolResults });
  if (data.recommendedActions?.length) parts.push({ kind: 'actions', data: data.recommendedActions });
  if (typeof data.confidence === 'number') parts.push({ kind: 'confidence', data: data.confidence });
  if (data.sources?.length) parts.push({ kind: 'sources', data: data.sources });
  if (data.insights?.length) parts.push({ kind: 'insights', data: data.insights });
  if (data.followUps?.length) parts.push({ kind: 'followups', data: data.followUps });

  await db.oracleAIMessage.create({
    data: {
      id,
      sessionId,
      firmId: DEFAULT_FIRM_ID,
      userId: null,
      role: 'assistant',
      content: data.content,
      parts: JSON.stringify(parts),
      latencyMs: data.latencyMs ?? 0,
      status: data.error ? 'error' : 'completed',
      error: data.error ?? null,
    },
  });
  await touchSession(sessionId);
  return id;
}

// ─── Tool-call audit (OracleAIToolCall) ────────────────────────────────────────

/** Record every tool execution for full traceability + audit. */
export async function auditToolCall(
  sessionId: string,
  result: ToolResult,
): Promise<void> {
  try {
    await db.oracleAIToolCall.create({
      data: {
        sessionId,
        firmId: DEFAULT_FIRM_ID,
        userId: null,
        toolName: result.name,
        args: '{}',
        result: result.summary.slice(0, 8000), // cap stored size
        status: 'success',
        durationMs: result.durationMs,
      },
    });
  } catch {
    // audit is best-effort; never fail the chat over a log write
  }
}

// ─── Semantic memory (OracleMemory) ────────────────────────────────────────────

/** Save a durable memory record for important conclusions/decisions. */
export async function saveMemory(data: {
  category: string;
  title: string;
  summary?: string;
  payload?: Record<string, unknown>;
  importance?: number;
  source?: string;
}): Promise<void> {
  try {
    await db.oracleMemory.create({
      data: {
        firmId: DEFAULT_FIRM_ID,
        userId: null,
        category: data.category,
        entityType: null,
        entityId: null,
        title: data.title,
        summary: data.summary ?? null,
        payload: JSON.stringify(data.payload ?? {}),
        tags: '[]',
        importance: data.importance ?? 50,
        source: data.source ?? 'oracle-chat',
        expiresAt: null,
      },
    });
  } catch {
    // best-effort
  }
}

/** Pull recent memory records for context (top by importance). */
export async function recallMemory(limit = 8): Promise<{ title: string; summary: string | null; category: string; importance: number }[]> {
  try {
    const rows = await db.oracleMemory.findMany({
      where: { firmId: DEFAULT_FIRM_ID },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
    return rows.map((r) => ({ title: r.title, summary: r.summary, category: r.category, importance: r.importance }));
  } catch {
    return [];
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseMeta(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return typeof v === 'object' && v ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Bump messageCount + lastMessageAt; set title from first user message if default. */
async function touchSession(sessionId: string, firstUserContent?: string): Promise<void> {
  const sess = await db.oracleAISession.findUnique({ where: { id: sessionId } });
  if (!sess) return;
  const isDefaultTitle = sess.title === 'New conversation' || !sess.title;
  const newTitle = isDefaultTitle && firstUserContent
    ? firstUserContent.slice(0, 80).replace(/\s+/g, ' ').trim() || 'New conversation'
    : sess.title;
  await db.oracleAISession.update({
    where: { id: sessionId },
    data: {
      messageCount: sess.messageCount + 1,
      lastMessageAt: new Date(),
      title: newTitle,
    },
  });
}

/** Convert a DB OracleAIMessage row back into a ChatMessage for the client. */
function dbRowToChatMessage(r: {
  id: string;
  role: string;
  content: string;
  parts: string;
  latencyMs: number;
  status: string;
  error: string | null;
  createdAt: Date;
}): ChatMessage {
  const parts: MessagePart[] = parseMeta(r.parts) ? safeParseParts(r.parts) : [];
  const msg: ChatMessage = {
    id: r.id,
    role: r.role === 'user' ? 'user' : 'oracle',
    content: r.content,
    dbMessageId: r.id,
    createdAt: r.createdAt.toISOString(),
  };
  if (r.status === 'error' || r.error) msg.error = true;
  for (const p of parts) {
    switch (p.kind) {
      case 'section': {
        const d = p.data as { which: string; text: string };
        if (d.which === 'executive_summary') msg.executiveSummary = d.text;
        else if (d.which === 'analysis') msg.analysis = d.text;
        else if (d.which === 'evidence') msg.evidence = d.text;
        break;
      }
      case 'tool_call': msg.toolCalls = p.data as ToolCall[]; break;
      case 'tool_result': msg.toolResults = p.data as ToolResult[]; break;
      case 'actions': msg.recommendedActions = p.data as RecommendedAction[]; break;
      case 'confidence': msg.confidence = p.data as number; break;
      case 'sources': msg.sources = p.data as SourceRef[]; break;
      case 'insights': msg.insights = p.data as ProactiveInsight[]; break;
      case 'followups': msg.followUps = p.data as string[]; break;
      default: break;
    }
  }
  return msg;
}

function safeParseParts(raw: string): MessagePart[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as MessagePart[]) : [];
  } catch {
    return [];
  }
}
