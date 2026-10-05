// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle Intelligence Core™ — Unified Memory Engine
// Oracle remembers everything. Every module writes here. Everything is searchable.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  MemoryCategory,
  MemoryRecord,
  MemorySearchResult,
  MemorySource,
} from './types';

const FIRM_ID = process.env.NEXT_PUBLIC_FIRM_ID || 'gstpilot-default-firm';

// ORACLE-SECURITY-FIX: Previously all functions in this file used the global
// FIRM_ID constant — a cross-tenant data leak. Now searchMemory / getMemoryStats
// accept an optional firmId parameter and filter by it. If firmId is not passed,
// they fall back to FIRM_ID (for backward compat with internal callers) but
// log a warning. API routes MUST pass the orgId from the auth context.

function safeParseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function serialize(r: {
  id: string;
  firmId: string;
  userId: string | null;
  category: string;
  entityType: string | null;
  entityId: string | null;
  title: string;
  summary: string;
  payload: string;
  tags: string;
  importance: number;
  source: string;
  createdAt: Date;
  expiresAt: Date | null;
}): MemoryRecord {
  return {
    id: r.id,
    firmId: r.firmId,
    userId: r.userId,
    category: r.category as MemoryCategory,
    entityType: r.entityType,
    entityId: r.entityId,
    title: r.title,
    summary: r.summary,
    payload: safeParseJSON<Record<string, unknown>>(r.payload, {}),
    tags: safeParseJSON<string[]>(r.tags, []),
    importance: r.importance,
    source: r.source as MemorySource,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
  };
}

export interface WriteMemoryInput {
  firmId?: string;
  userId?: string | null;
  category: MemoryCategory;
  entityType?: string | null;
  entityId?: string | null;
  title: string;
  summary: string;
  payload?: Record<string, unknown>;
  tags?: string[];
  importance?: number;
  source: MemorySource;
  expiresAt?: Date | null;
}

/** Write a memory record. Used by every AI module. */
export async function writeMemory(input: WriteMemoryInput): Promise<MemoryRecord> {
  const firmId = input.firmId || FIRM_ID;
  const created = await db.oracleMemory.create({
    data: {
      firmId,
      userId: input.userId ?? null,
      category: input.category,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      title: input.title,
      summary: input.summary,
      payload: JSON.stringify(input.payload ?? {}),
      tags: JSON.stringify(input.tags ?? []),
      importance: input.importance ?? 50,
      source: input.source,
      expiresAt: input.expiresAt ?? null,
    },
  });
  return serialize(created);
}

/** Batch-write multiple memory records (used by Knowledge Synthesis). */
export async function writeMemoryBatch(inputs: WriteMemoryInput[]): Promise<number> {
  let count = 0;
  for (const input of inputs) {
    try {
      await writeMemory(input);
      count++;
    } catch (e) {
      console.warn('[Oracle Memory] batch write failed for one record:', e);
    }
  }
  return count;
}

export interface SearchMemoryInput {
  firmId?: string;
  query?: string;
  category?: MemoryCategory;
  source?: MemorySource;
  entityType?: string;
  entityId?: string;
  limit?: number;
  minImportance?: number;
  since?: Date;
}

/** Search unified memory. Free-text matches title/summary/tags. */
export async function searchMemory(input: SearchMemoryInput): Promise<MemorySearchResult> {
  // ORACLE-SECURITY-FIX: use the caller-provided firmId; warn if missing.
  const firmId = input.firmId || FIRM_ID;
  if (!input.firmId) {
    console.warn('[oracle-core/memory] searchMemory called without firmId — using global fallback. This is a cross-tenant risk.');
  }
  const where: Record<string, unknown> = { firmId };

  if (input.category) where.category = input.category;
  if (input.source) where.source = input.source;
  if (input.entityType) where.entityType = input.entityType;
  if (input.entityId) where.entityId = input.entityId;
  if (input.minImportance !== undefined) where.importance = { gte: input.minImportance };
  if (input.since) where.createdAt = { gte: input.since };

  if (input.query) {
    // SQLite doesn't support full-text search natively via Prisma; use contains.
    where.OR = [
      { title: { contains: input.query } },
      { summary: { contains: input.query } },
      { tags: { contains: input.query } },
    ];
  }

  const limit = Math.min(input.limit ?? 50, 200);
  const rows = await db.oracleMemory.findMany({
    where,
    orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });

  const records = rows.map(serialize);
  const sources = Array.from(new Set(records.map((r) => r.source)));
  const suggestions = generateSuggestions(records, input.query);

  return {
    total: records.length,
    records,
    sources,
    suggestions,
  };
}

/** Retrieve a single memory record by id. */
export async function getMemory(id: string): Promise<MemoryRecord | null> {
  const row = await db.oracleMemory.findUnique({ where: { id } });
  return row ? serialize(row) : null;
}

/** Get the most recent N memories for a given entity. */
export async function getEntityMemory(
  entityType: string,
  entityId: string,
  limit = 20,
): Promise<MemoryRecord[]> {
  const rows = await db.oracleMemory.findMany({
    where: { firmId: FIRM_ID, entityType, entityId },
    orderBy: [{ createdAt: 'desc' }],
    take: Math.min(limit, 100),
  });
  return rows.map(serialize);
}

/** Memory statistics for the dashboard. */
export async function getMemoryStats(firmId?: string): Promise<{
  totalRecords: number;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  last24h: number;
}> {
  // ORACLE-SECURITY-FIX: use the caller-provided firmId; warn if missing.
  const effectiveFirmId = firmId || FIRM_ID;
  if (!firmId) {
    console.warn('[oracle-core/memory] getMemoryStats called without firmId — using global fallback. This is a cross-tenant risk.');
  }
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [total, last24h, byCategoryRows, bySourceRows] = await Promise.all([
    db.oracleMemory.count({ where: { firmId: effectiveFirmId } }),
    db.oracleMemory.count({ where: { firmId: effectiveFirmId, createdAt: { gte: since24h } } }),
    db.oracleMemory.groupBy({
      by: ['category'],
      where: { firmId: effectiveFirmId },
      _count: { _all: true },
    }),
    db.oracleMemory.groupBy({
      by: ['source'],
      where: { firmId: effectiveFirmId },
      _count: { _all: true },
    }),
  ]);

  const byCategory: Record<string, number> = {};
  for (const r of byCategoryRows) byCategory[r.category] = r._count._all;
  const bySource: Record<string, number> = {};
  for (const r of bySourceRows) bySource[r.source] = r._count._all;

  return { totalRecords: total, byCategory, bySource, last24h };
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function generateSuggestions(records: MemoryRecord[], query?: string): string[] {
  const suggestions: string[] = [];
  if (query) {
    suggestions.push(`Show me more about "${query}"`);
    suggestions.push(`What decisions were made about "${query}"?`);
  }
  // Pull top entity types
  const entityTypes = new Set<string>();
  for (const r of records) {
    if (r.entityType) entityTypes.add(r.entityType);
    if (entityTypes.size >= 3) break;
  }
  for (const et of entityTypes) {
    suggestions.push(`Summarize recent ${et} activity`);
  }
  if (suggestions.length === 0) {
    suggestions.push('What should I focus on today?');
    suggestions.push('Show me revenue trends');
    suggestions.push('Any compliance risks?');
  }
  return suggestions.slice(0, 5);
}
