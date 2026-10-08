// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Memory Timeline (PROMPT 6)
//
// Groups memories into Today / Yesterday / Last Week / Last Month / Older
// buckets for the timeline UI view. Also provides a keyword-filtered timeline
// search and aggregate stats (counts only — no rows loaded).
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { BrainMemory, BrainMemoryType, MemoryTimeline, TimelineBucket } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    embedding: null, // not needed for timeline display
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

function bucketFor(createdAt: Date, now: Date): TimelineBucket {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  if (createdAt >= startOfToday) return 'today';
  if (createdAt >= startOfYesterday) return 'yesterday';
  if (createdAt >= sevenDaysAgo) return 'last_week';
  if (createdAt >= thirtyDaysAgo) return 'last_month';
  return 'older';
}

const BUCKET_CAP = 50;

// ─── Public API ───────────────────────────────────────────────────────────────

/** Get memories bucketed by time period (today/yesterday/last_week/last_month/older). */
export async function getMemoryTimeline(opts: {
  firmId: string;
  types?: BrainMemoryType[];
  limit?: number;
}): Promise<MemoryTimeline> {
  try {
    const where: Record<string, unknown> = {
      firmId: opts.firmId,
      archived: false,
    };
    if (opts.types && opts.types.length > 0) {
      where.type = { in: opts.types };
    }
    const rows = await db.oracleBrainMemory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 200,
    });

    const now = new Date();
    const buckets: MemoryTimeline = {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
      total: rows.length,
    };
    for (const row of rows) {
      const mem = mapRow(row as unknown as MemoryRow);
      const bucket = bucketFor(row.createdAt, now);
      const arr = buckets[bucket];
      if (arr.length < BUCKET_CAP) arr.push(mem);
    }
    return buckets;
  } catch (err) {
    throw new Error(
      `getMemoryTimeline failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Keyword-filtered timeline search. */
export async function searchTimeline(opts: {
  firmId: string;
  query: string;
  types?: BrainMemoryType[];
  limit?: number;
}): Promise<MemoryTimeline> {
  try {
    const q = opts.query.trim();
    if (!q) return getMemoryTimeline(opts);
    const where: Record<string, unknown> = {
      firmId: opts.firmId,
      archived: false,
      OR: [
        { title: { contains: q } },
        { content: { contains: q } },
        { summary: { contains: q } },
      ],
    };
    if (opts.types && opts.types.length > 0) {
      where.type = { in: opts.types };
    }
    const rows = await db.oracleBrainMemory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 200,
    });

    const now = new Date();
    const buckets: MemoryTimeline = {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
      total: rows.length,
    };
    for (const row of rows) {
      const mem = mapRow(row as unknown as MemoryRow);
      const bucket = bucketFor(row.createdAt, now);
      const arr = buckets[bucket];
      if (arr.length < BUCKET_CAP) arr.push(mem);
    }
    return buckets;
  } catch (err) {
    throw new Error(
      `searchTimeline failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Aggregate counts only (no rows loaded) — for stats badges. */
export async function getTimelineStats(
  firmId: string,
): Promise<{
  total: number;
  today: number;
  yesterday: number;
  lastWeek: number;
  lastMonth: number;
  older: number;
  byType: Record<string, number>;
}> {
  try {
    const rows = await db.oracleBrainMemory.findMany({
      where: { firmId, archived: false },
      select: { type: true, createdAt: true },
    });
    const now = new Date();
    const stats = {
      total: rows.length,
      today: 0,
      yesterday: 0,
      lastWeek: 0,
      lastMonth: 0,
      older: 0,
      byType: {} as Record<string, number>,
    };
    for (const r of rows) {
      const bucket = bucketFor(r.createdAt, now);
      stats[bucket]++;
      stats.byType[r.type] = (stats.byType[r.type] ?? 0) + 1;
    }
    return stats;
  } catch (err) {
    throw new Error(
      `getTimelineStats failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
