// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Memory Engine (PROMPT 6)
//
// The core persistent-memory CRUD + retrieval layer for the Oracle Business
// Brain. Wraps the `OracleBrainMemory` Prisma model and provides typed
// create / read / update / delete / list / pin / archive operations, plus
// higher-level helpers for conversation memory, recent/pinned views, keyword
// search, and the context snapshot that is injected into the Oracle system
// prompt.
//
// All JSON-shaped columns (tags, metadata) are stringified before write and
// parsed after read. Embeddings are generated via the local hashing embedder
// (see ./embedding) unless `skipEmbedding` is set.
// ═══════════════════════════════════════════════════════════════════════════════

import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import {
  embed,
  serializeEmbedding,
  deserializeEmbedding,
} from './embedding';
import { semanticSearch } from './semantic-search';
import type {
  BrainMemory,
  BrainMemoryType,
  BrainContextSnapshot,
  ConversationMemoryRecord,
  CreateMemoryInput,
} from './types';

// ─── Row mapping ──────────────────────────────────────────────────────────────

/**
 * Prisma row payload for OracleBrainMemory (full row, no select subset).
 * Accepting the loose Prisma payload type here keeps `mapRow` decoupled from
 * the exact generated client shape while remaining strictly typed at the
 * boundary.
 */
type MemoryRow = Prisma.OracleBrainMemoryGetPayload<object>;

/**
 * Map a raw Prisma OracleBrainMemory row to the BrainMemory interface.
 * Parses JSON columns (tags, metadata), deserializes the embedding vector,
 * and normalises all Date fields to ISO strings. Internal — not exported.
 */
function mapRow(row: MemoryRow): BrainMemory {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags ?? '[]');
    if (Array.isArray(parsed)) tags = parsed.filter((t): t is string => typeof t === 'string');
  } catch {
    tags = [];
  }

  let metadata: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.metadata ?? '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      metadata = parsed as Record<string, unknown>;
    }
  } catch {
    metadata = {};
  }

  return {
    id: row.id,
    firmId: row.firmId,
    userId: row.userId,
    type: row.type as BrainMemoryType,
    subtype: row.subtype,
    title: row.title,
    content: row.content,
    summary: row.summary,
    embedding: deserializeEmbedding(row.embedding),
    tags,
    importance: row.importance,
    pinned: row.pinned,
    source: row.source,
    metadata,
    archived: row.archived,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Create a new persistent memory record. Auto-generates an embedding from
 * `content + ' ' + title` unless `input.skipEmbedding` is true.
 */
export async function createMemory(input: CreateMemoryInput): Promise<BrainMemory> {
  try {
    let embeddingSerialized: string | null = null;
    if (!input.skipEmbedding) {
      const vec = await embed(`${input.content} ${input.title}`);
      embeddingSerialized = serializeEmbedding(vec);
    }

    const row = await db.oracleBrainMemory.create({
      data: {
        firmId: input.firmId,
        userId: input.userId ?? null,
        type: input.type,
        subtype: input.subtype ?? null,
        title: input.title,
        content: input.content,
        summary: input.summary ?? null,
        embedding: embeddingSerialized,
        tags: JSON.stringify(input.tags ?? []),
        importance: input.importance ?? 50,
        pinned: input.pinned ?? false,
        source: input.source ?? 'oracle',
        metadata: JSON.stringify(input.metadata ?? {}),
        archived: false,
        expiresAt: input.expiresAt ?? null,
      },
    });
    return mapRow(row);
  } catch (err) {
    throw new Error(
      `createMemory failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Update a memory's editable fields. Regenerates the embedding automatically
 * when `title` or `content` change. JSON-stringifies tags/metadata before write.
 */
export async function updateMemory(
  id: string,
  patch: Partial<
    Pick<
      BrainMemory,
      'title' | 'content' | 'summary' | 'tags' | 'importance' | 'pinned' | 'archived' | 'metadata'
    >
  >,
): Promise<BrainMemory> {
  try {
    const data: Prisma.OracleBrainMemoryUpdateInput = {};

    if (patch.title !== undefined) data.title = patch.title;
    if (patch.content !== undefined) data.content = patch.content;
    if (patch.summary !== undefined) data.summary = patch.summary;
    if (patch.tags !== undefined) data.tags = JSON.stringify(patch.tags);
    if (patch.importance !== undefined) data.importance = patch.importance;
    if (patch.pinned !== undefined) data.pinned = patch.pinned;
    if (patch.archived !== undefined) data.archived = patch.archived;
    if (patch.metadata !== undefined) data.metadata = JSON.stringify(patch.metadata);

    // Regenerate embedding if the indexed text changed.
    if (patch.content !== undefined || patch.title !== undefined) {
      const existing = await db.oracleBrainMemory.findUnique({
        where: { id },
        select: { title: true, content: true },
      });
      if (!existing) throw new Error('memory not found');
      const newTitle = patch.title ?? existing.title;
      const newContent = patch.content ?? existing.content;
      const vec = await embed(`${newContent} ${newTitle}`);
      data.embedding = serializeEmbedding(vec);
    }

    const row = await db.oracleBrainMemory.update({ where: { id }, data });
    return mapRow(row);
  } catch (err) {
    throw new Error(
      `updateMemory failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Fetch a single memory by id. Returns null if not found.
 */
export async function getMemory(id: string): Promise<BrainMemory | null> {
  try {
    const row = await db.oracleBrainMemory.findUnique({ where: { id } });
    return row ? mapRow(row) : null;
  } catch (err) {
    throw new Error(
      `getMemory failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * List memories for a firm, optionally filtered by type / pinned / archived.
 * Ordered by pinned DESC then createdAt DESC. Default limit 50.
 */
export async function listMemories(opts: {
  firmId: string;
  types?: BrainMemoryType[];
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
  pinnedOnly?: boolean;
}): Promise<BrainMemory[]> {
  try {
    const rows = await db.oracleBrainMemory.findMany({
      where: {
        firmId: opts.firmId,
        ...(opts.includeArchived ? {} : { archived: false }),
        ...(opts.types?.length ? { type: { in: opts.types } } : {}),
        ...(opts.pinnedOnly ? { pinned: true } : {}),
      },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: opts.limit ?? 50,
      skip: opts.offset ?? 0,
    });
    return rows.map(mapRow);
  } catch (err) {
    throw new Error(
      `listMemories failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Flip (or explicitly set) the pinned flag on a memory.
 */
export async function togglePin(id: string, pinned?: boolean): Promise<BrainMemory> {
  try {
    let nextPinned = pinned;
    if (nextPinned === undefined) {
      const existing = await db.oracleBrainMemory.findUnique({
        where: { id },
        select: { pinned: true },
      });
      if (!existing) throw new Error('memory not found');
      nextPinned = !existing.pinned;
    }
    const row = await db.oracleBrainMemory.update({
      where: { id },
      data: { pinned: nextPinned },
    });
    return mapRow(row);
  } catch (err) {
    throw new Error(
      `togglePin failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Archive a memory (soft delete). Sets archived=true.
 */
export async function archiveMemory(id: string): Promise<BrainMemory> {
  try {
    const row = await db.oracleBrainMemory.update({
      where: { id },
      data: { archived: true },
    });
    return mapRow(row);
  } catch (err) {
    throw new Error(
      `archiveMemory failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Hard-delete a memory record permanently.
 */
export async function deleteMemory(id: string): Promise<void> {
  try {
    await db.oracleBrainMemory.delete({ where: { id } });
  } catch (err) {
    throw new Error(
      `deleteMemory failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Case-insensitive SQLite LIKE keyword search across title + content + summary.
 * Ordered by createdAt DESC.
 */
export async function searchMemoriesByKeyword(opts: {
  firmId: string;
  query: string;
  types?: BrainMemoryType[];
  limit?: number;
}): Promise<BrainMemory[]> {
  try {
    const q = opts.query.trim();
    if (!q) return [];
    const rows = await db.oracleBrainMemory.findMany({
      where: {
        firmId: opts.firmId,
        archived: false,
        ...(opts.types?.length ? { type: { in: opts.types } } : {}),
        OR: [
          { title: { contains: q } },
          { content: { contains: q } },
          { summary: { contains: q } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 20,
    });
    return rows.map(mapRow);
  } catch (err) {
    throw new Error(
      `searchMemoriesByKeyword failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ─── Conversation memory ──────────────────────────────────────────────────────

/**
 * Persist a conversation exchange as a 'conversation' / 'full' memory and
 * index each topic as a lightweight 'topics' sub-memory for fast topic recall.
 * Topic-indexing failures never block the primary memory write.
 */
export async function storeConversationMemory(
  record: ConversationMemoryRecord,
): Promise<BrainMemory> {
  try {
    const title = record.userMessage.slice(0, 60);
    const content = [
      `USER Q: ${record.userMessage}`,
      `ORACLE A: ${record.oracleResponse}`,
      `INTENT: ${record.intent ?? 'n/a'}`,
      `TOPICS: ${record.topics.join(', ')}`,
      `ACTIONS: ${record.actions.join(', ')}`,
      `RESULT: ${record.result ?? 'n/a'}`,
      `SUMMARY: ${record.summary}`,
    ].join('\n');

    const memory = await createMemory({
      firmId: record.firmId,
      userId: record.userId,
      type: 'conversation',
      subtype: 'full',
      title,
      content,
      summary: record.summary,
      tags: record.topics,
      importance: 60,
      metadata: {
        conversationId: record.conversationId,
        intent: record.intent ?? null,
        topics: record.topics,
        actions: record.actions,
        result: record.result ?? null,
        createdAt: record.createdAt.toISOString(),
      },
    });

    // Lightweight per-topic index entries (no embedding — saves write cost).
    if (record.topics.length > 0) {
      try {
        for (const topic of record.topics) {
          await createMemory({
            firmId: record.firmId,
            userId: record.userId,
            type: 'conversation',
            subtype: 'topics',
            title: `Topic: ${topic}`,
            content: topic,
            summary: topic,
            tags: [topic],
            importance: 40,
            skipEmbedding: true,
            metadata: {
              conversationId: record.conversationId,
              topic,
              createdAt: record.createdAt.toISOString(),
            },
          });
        }
      } catch {
        // Topic index is best-effort: never fail the primary memory write.
      }
    }

    return memory;
  } catch (err) {
    throw new Error(
      `storeConversationMemory failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ─── Quick views ──────────────────────────────────────────────────────────────

/**
 * Return the last N non-archived memories across all types, newest first.
 * Default limit 20.
 */
export async function getRecentMemories(
  firmId: string,
  limit: number = 20,
): Promise<BrainMemory[]> {
  try {
    const rows = await db.oracleBrainMemory.findMany({
      where: { firmId, archived: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(mapRow);
  } catch (err) {
    throw new Error(
      `getRecentMemories failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Return all pinned (non-archived) memories for a firm, ordered by importance.
 */
export async function getPinnedMemories(firmId: string): Promise<BrainMemory[]> {
  try {
    const rows = await db.oracleBrainMemory.findMany({
      where: { firmId, pinned: true, archived: false },
      orderBy: { importance: 'desc' },
    });
    return rows.map(mapRow);
  } catch (err) {
    throw new Error(
      `getPinnedMemories failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ─── Context snapshot ─────────────────────────────────────────────────────────

/**
 * Build the BrainContextSnapshot injected into the Oracle system prompt:
 * business facts, user prefs, open decisions, active tasks, semantically
 * relevant memories (or recent conversations), and behavioural learnings.
 * All sub-queries run in parallel via Promise.all.
 */
export async function getContextSnapshot(
  firmId: string,
  query?: string,
): Promise<BrainContextSnapshot> {
  try {
    const [
      businessFacts,
      userPreferences,
      openDecisions,
      activeTasks,
      learnings,
      relevantMemories,
    ] = await Promise.all([
      // businessFacts: top 8 type='business' OR type='fact', pinned first then importance.
      (async () => {
        const rows = await db.oracleBrainMemory.findMany({
          where: { firmId, archived: false, type: { in: ['business', 'fact'] } },
          orderBy: [{ pinned: 'desc' }, { importance: 'desc' }],
          take: 8,
        });
        return rows.map(mapRow);
      })(),
      // userPreferences: top 5 type='user' by importance DESC.
      (async () => {
        const rows = await db.oracleBrainMemory.findMany({
          where: { firmId, archived: false, type: 'user' },
          orderBy: { importance: 'desc' },
          take: 5,
        });
        return rows.map(mapRow);
      })(),
      // openDecisions: top 5 type='decision' by createdAt DESC.
      (async () => {
        const rows = await db.oracleBrainMemory.findMany({
          where: { firmId, archived: false, type: 'decision' },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });
        return rows.map(mapRow);
      })(),
      // activeTasks: top 6 type='task' by createdAt DESC.
      (async () => {
        const rows = await db.oracleBrainMemory.findMany({
          where: { firmId, archived: false, type: 'task' },
          orderBy: { createdAt: 'desc' },
          take: 6,
        });
        return rows.map(mapRow);
      })(),
      // learnings: top 4 type='learning' by updatedAt DESC.
      (async () => {
        const rows = await db.oracleBrainMemory.findMany({
          where: { firmId, archived: false, type: 'learning' },
          orderBy: { updatedAt: 'desc' },
          take: 4,
        });
        return rows.map(mapRow);
      })(),
      // relevantMemories: semantic search if query provided, else recent conversations.
      (async (): Promise<BrainMemory[]> => {
        if (query && query.trim()) {
          const results = await semanticSearch({
            firmId,
            query,
            topK: 5,
            types: ['conversation', 'business', 'fact', 'decision'],
          });
          return results.map((r) => r.memory);
        }
        const rows = await db.oracleBrainMemory.findMany({
          where: { firmId, archived: false, type: 'conversation' },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });
        return rows.map(mapRow);
      })(),
    ]);

    return {
      businessFacts,
      userPreferences,
      openDecisions,
      activeTasks,
      relevantMemories,
      learnings,
    };
  } catch (err) {
    throw new Error(
      `getContextSnapshot failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
