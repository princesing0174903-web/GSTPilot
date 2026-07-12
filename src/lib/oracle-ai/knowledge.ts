// ═══════════════════════════════════════════════════════════════════════════════
// Oracle AI™ Intelligence Layer — Knowledge Base
//
// CRUD for the curated firm knowledge base. Entries are categorized (GST,
// compliance, finance, operations, legal, general), tagged, source-attributed,
// and confidence-scored. The `search-knowledge` tool queries this table.
//
// Phase 2 will add vector embeddings + semantic search. For now we use SQLite
// `contains` queries (case-insensitive substring match).
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { KnowledgeCategory, OracleAIKnowledge } from './types';

const FIRM_ID = process.env.NEXT_PUBLIC_FIRM_ID || 'gstpilot-default-firm';

function serialize(r: {
  id: string;
  firmId: string;
  title: string;
  content: string;
  category: string;
  tags: string;
  source: string | null;
  sourceType: string;
  confidence: number;
  pinned: boolean;
  viewCount: number;
  metadata: string;
  createdAt: Date;
  updatedAt: Date;
}): OracleAIKnowledge {
  let tags: string[] = [];
  let metadata: Record<string, unknown> = {};
  try {
    tags = JSON.parse(r.tags) as string[];
  } catch {
    tags = [];
  }
  try {
    metadata = JSON.parse(r.metadata) as Record<string, unknown>;
  } catch {
    metadata = {};
  }
  return {
    id: r.id,
    firmId: r.firmId,
    title: r.title,
    content: r.content,
    category: r.category as KnowledgeCategory,
    tags,
    source: r.source,
    sourceType: r.sourceType as OracleAIKnowledge['sourceType'],
    confidence: r.confidence,
    pinned: r.pinned,
    viewCount: r.viewCount,
    metadata,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function createKnowledge(input: {
  firmId?: string;
  title: string;
  content: string;
  category?: KnowledgeCategory;
  tags?: string[];
  source?: string | null;
  sourceType?: 'manual' | 'imported' | 'generated' | 'url';
  confidence?: number;
  pinned?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<OracleAIKnowledge> {
  const firmId = input.firmId || FIRM_ID;
  const row = await db.oracleAIKnowledge.create({
    data: {
      firmId,
      title: input.title,
      content: input.content,
      category: input.category ?? 'general',
      tags: JSON.stringify(input.tags ?? []),
      source: input.source ?? null,
      sourceType: input.sourceType ?? 'manual',
      confidence: Math.max(0, Math.min(1, input.confidence ?? 0.8)),
      pinned: input.pinned ?? false,
      metadata: JSON.stringify(input.metadata ?? {}),
    },
  });
  return serialize(row);
}

export async function listKnowledge(input: {
  firmId?: string;
  category?: KnowledgeCategory;
  query?: string;
  pinnedOnly?: boolean;
  limit?: number;
}): Promise<OracleAIKnowledge[]> {
  const firmId = input.firmId || FIRM_ID;
  const limit = Math.min(200, input.limit ?? 50);
  const where: {
    firmId: string;
    category?: string;
    pinned?: boolean;
    OR?: { title?: { contains: string }; content?: { contains: string } }[];
  } = { firmId };
  if (input.category) where.category = input.category;
  if (input.pinnedOnly) where.pinned = true;
  if (input.query) {
    where.OR = [
      { title: { contains: input.query } },
      { content: { contains: input.query } },
    ];
  }
  const rows = await db.oracleAIKnowledge.findMany({
    where,
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    take: limit,
  });
  return rows.map(serialize);
}

export async function getKnowledge(id: string, firmId: string = FIRM_ID): Promise<OracleAIKnowledge | null> {
  const row = await db.oracleAIKnowledge.findFirst({ where: { id, firmId } });
  if (!row) return null;
  // Increment view count
  await db.oracleAIKnowledge.update({ where: { id }, data: { viewCount: { increment: 1 } } });
  return serialize(row);
}

export async function updateKnowledge(
  id: string,
  input: Partial<{
    title: string;
    content: string;
    category: KnowledgeCategory;
    tags: string[];
    source: string | null;
    confidence: number;
    pinned: boolean;
  }>,
  firmId: string = FIRM_ID,
): Promise<OracleAIKnowledge | null> {
  const data: {
    title?: string;
    content?: string;
    category?: string;
    tags?: string;
    source?: string | null;
    confidence?: number;
    pinned?: boolean;
  } = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.content !== undefined) data.content = input.content;
  if (input.category !== undefined) data.category = input.category;
  if (input.tags !== undefined) data.tags = JSON.stringify(input.tags);
  if (input.source !== undefined) data.source = input.source;
  if (input.confidence !== undefined) data.confidence = Math.max(0, Math.min(1, input.confidence));
  if (input.pinned !== undefined) data.pinned = input.pinned;
  const row = await db.oracleAIKnowledge
    .updateMany({ where: { id, firmId }, data })
    .catch(() => null);
  if (!row) return null;
  const updated = await db.oracleAIKnowledge.findFirst({ where: { id, firmId } });
  return updated ? serialize(updated) : null;
}

export async function deleteKnowledge(id: string, firmId: string = FIRM_ID): Promise<void> {
  await db.oracleAIKnowledge.deleteMany({ where: { id, firmId } });
}

export async function getKnowledgeStats(firmId: string = FIRM_ID): Promise<{
  total: number;
  byCategory: Record<string, number>;
  pinned: number;
}> {
  const rows = await db.oracleAIKnowledge.groupBy({
    by: ['category'],
    where: { firmId },
    _count: true,
  });
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    byCategory[r.category] = r._count;
    total += r._count;
  }
  const pinnedRows = await db.oracleAIKnowledge.count({ where: { firmId, pinned: true } });
  return { total, byCategory, pinned: pinnedRows };
}
