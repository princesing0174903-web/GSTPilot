// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Semantic Search (PROMPT 6)
//
// Top-k cosine-similarity retrieval over OracleBrainMemory embeddings.
// Combines the speed of local feature-hash embeddings with the recall of
// keyword search via a hybrid ranking function.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { embed, cosineSimilarity, deserializeEmbedding } from './embedding';
import type {
  BrainMemory,
  SemanticSearchParams,
  SemanticSearchResult,
} from './types';
import { searchMemoriesByKeyword } from './memory-engine';

// ─── Row mapper (mirrors memory-engine.mapRow but local to avoid circular import) ─

interface MemoryRow {
  id: string;
  firmId: string;
  userId: string | null;
  type: string;
  subtype: string | null;
  title: string;
  content: string;
  summary: string | null;
  embedding: string | null;
  tags: string;
  importance: number;
  pinned: boolean;
  source: string;
  metadata: string;
  archived: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: MemoryRow): BrainMemory {
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags || '[]');
  } catch {
    tags = [];
  }
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(row.metadata || '{}');
  } catch {
    metadata = {};
  }
  return {
    id: row.id,
    firmId: row.firmId,
    userId: row.userId,
    type: row.type as BrainMemory['type'],
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
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Pure semantic search ────────────────────────────────────────────────────

/**
 * Top-k cosine similarity search over embedded memories.
 * Returns memories ranked by embedding similarity to the query.
 */
export async function semanticSearch(
  params: SemanticSearchParams,
): Promise<SemanticSearchResult[]> {
  try {
    const queryEmb = embed(params.query);
    if (!queryEmb) return [];

    const candidates = await db.oracleBrainMemory.findMany({
      where: {
        firmId: params.firmId,
        archived: params.includeArchived ? undefined : false,
        ...(params.types && params.types.length > 0
          ? { type: { in: params.types } }
          : {}),
        embedding: { not: null },
      },
      select: {
        id: true,
        firmId: true,
        userId: true,
        type: true,
        subtype: true,
        title: true,
        content: true,
        summary: true,
        embedding: true,
        tags: true,
        importance: true,
        pinned: true,
        source: true,
        metadata: true,
        archived: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const minScore = params.minScore ?? 0.15;
    const results: SemanticSearchResult[] = [];

    for (const row of candidates) {
      const candEmb = deserializeEmbedding(row.embedding);
      const score = cosineSimilarity(queryEmb, candEmb);
      if (score >= minScore) {
        results.push({ memory: mapRow(row as unknown as MemoryRow), score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, params.topK ?? 5);
  } catch (err) {
    throw new Error(
      `semanticSearch failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ─── Find similar memories to a given one ─────────────────────────────────────

/**
 * Find memories similar to an existing memory (by its embedding).
 */
export async function findSimilarMemories(
  memoryId: string,
  topK = 5,
): Promise<SemanticSearchResult[]> {
  try {
    const source = await db.oracleBrainMemory.findUnique({
      where: { id: memoryId },
      select: { firmId: true, embedding: true },
    });
    if (!source || !source.embedding) return [];

    const sourceEmb = deserializeEmbedding(source.embedding);
    if (!sourceEmb) return [];

    const candidates = await db.oracleBrainMemory.findMany({
      where: {
        firmId: source.firmId,
        archived: false,
        id: { not: memoryId },
        embedding: { not: null },
      },
      select: {
        id: true,
        firmId: true,
        userId: true,
        type: true,
        subtype: true,
        title: true,
        content: true,
        summary: true,
        embedding: true,
        tags: true,
        importance: true,
        pinned: true,
        source: true,
        metadata: true,
        archived: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const results: SemanticSearchResult[] = [];
    for (const row of candidates) {
      const candEmb = deserializeEmbedding(row.embedding);
      const score = cosineSimilarity(sourceEmb, candEmb);
      if (score >= 0.15) {
        results.push({ memory: mapRow(row as unknown as MemoryRow), score });
      }
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  } catch (err) {
    throw new Error(
      `findSimilarMemories failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ─── Hybrid search (semantic + keyword, best of both) ─────────────────────────

/**
 * Hybrid search: blends semantic similarity with keyword matching.
 * Score = 0.6 * semanticScore + 0.4 * keywordBoost.
 * keywordBoost: 1.0 if title matches, 0.6 if content matches, 0.3 if summary matches.
 */
export async function hybridSearch(
  params: SemanticSearchParams,
): Promise<SemanticSearchResult[]> {
  try {
    const [semantic, keyword] = await Promise.all([
      semanticSearch({ ...params, topK: (params.topK ?? 5) * 3, minScore: 0 }),
      searchMemoriesByKeyword({
        firmId: params.firmId,
        query: params.query,
        types: params.types,
        limit: (params.topK ?? 5) * 3,
      }),
    ]);

    const merged = new Map<string, SemanticSearchResult>();
    for (const r of semantic) {
      merged.set(r.memory.id, { memory: r.memory, score: 0.6 * r.score });
    }
    for (const m of keyword) {
      const existing = merged.get(m.id);
      let boost = 0;
      const q = params.query.toLowerCase();
      if (m.title.toLowerCase().includes(q)) boost = 1.0;
      else if (m.content.toLowerCase().includes(q)) boost = 0.6;
      else if (m.summary?.toLowerCase().includes(q)) boost = 0.3;
      const blended = 0.4 * boost;
      if (existing) {
        existing.score += blended;
      } else {
        merged.set(m.id, { memory: m, score: blended });
      }
    }

    const results = Array.from(merged.values())
      .filter((r) => r.score >= (params.minScore ?? 0.1))
      .sort((a, b) => b.score - a.score);
    return results.slice(0, params.topK ?? 5);
  } catch (err) {
    throw new Error(
      `hybridSearch failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
