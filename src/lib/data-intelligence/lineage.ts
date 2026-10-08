// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — Global Data Intelligence Cloud™
// Subsystem 3: Data Lineage™
// ═══════════════════════════════════════════════════════════════════════════════
//
// Tracks the full origin → transformation → usage chain for every dataset. Each
// recorded event captures the actor (oracle / ai_cfo / human / connector / etc),
// the action narrative, upstream + downstream dataset references, and before /
// after JSON snapshots. Every event is assigned a replay token so the recorded
// after-state can be re-materialised on demand (read-only replay).
//
// All queries go through safeFindMany / safeAggregate so empty tables never crash.
// No mock data. Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { DataLineageEvent as PrismaLineageEventRow } from '@prisma/client';
import {
  db, parseJson, safeFindMany, safeAggregate, cached, TTL, countBy, makeReplayToken,
} from './helpers';
import type {
  DataLineageEvent,
  LineageActorType,
  LineageEventType,
} from './types';

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapLineageEvent(row: PrismaLineageEventRow): DataLineageEvent {
  return {
    id: row.id,
    datasetKey: row.datasetKey,
    eventType: row.eventType as LineageEventType,
    actorId: row.actorId,
    actorType: row.actorType as LineageActorType,
    action: row.action,
    upstreamRefs: parseJson<string[]>(row.upstreamRefs, []),
    downstreamRefs: parseJson<string[]>(row.downstreamRefs, []),
    beforeSnapshot: parseJson<Record<string, unknown>>(row.beforeSnapshot, {}),
    afterSnapshot: parseJson<Record<string, unknown>>(row.afterSnapshot, {}),
    replayToken: row.replayToken,
    occurredAt: row.occurredAt.toISOString(),
  };
}

// ─── 1. recordLineageEvent ────────────────────────────────────────────────────

export interface LineageEventInput {
  datasetKey: string;
  eventType: LineageEventType;
  actorId?: string | null;
  actorType: LineageActorType;
  action: string;
  upstreamRefs?: string[];
  downstreamRefs?: string[];
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
}

/**
 * Persist a lineage event. Generates a deterministic replay token via
 * makeReplayToken(`ln-<datasetKey>`). Returns the mapped event.
 */
export async function recordLineageEvent(input: LineageEventInput): Promise<DataLineageEvent> {
  const replayToken = makeReplayToken(`ln-${input.datasetKey}`);
  const created = await db.dataLineageEvent.create({
    data: {
      datasetKey: input.datasetKey,
      eventType: input.eventType,
      actorId: input.actorId ?? null,
      actorType: input.actorType,
      action: input.action,
      upstreamRefs: JSON.stringify(input.upstreamRefs ?? []),
      downstreamRefs: JSON.stringify(input.downstreamRefs ?? []),
      beforeSnapshot: JSON.stringify(input.beforeSnapshot ?? {}),
      afterSnapshot: JSON.stringify(input.afterSnapshot ?? {}),
      replayToken,
    },
  });
  return mapLineageEvent(created);
}

// ─── 2. getLineage ────────────────────────────────────────────────────────────

/**
 * Return recent lineage events, optionally filtered by datasetKey, newest first.
 */
export async function getLineage(
  datasetKey?: string,
  limit = 50,
): Promise<DataLineageEvent[]> {
  const rows = await safeFindMany(() =>
    db.dataLineageEvent.findMany({
      where: datasetKey ? { datasetKey } : undefined,
      orderBy: { occurredAt: 'desc' },
      take: Math.max(1, Math.min(limit, 500)),
    }),
  );
  return rows.map(mapLineageEvent);
}

// ─── 3. getLineageSummary ─────────────────────────────────────────────────────

export interface LineageSummary {
  totalEvents: number;
  byEventType: Record<string, number>;
  byActorType: Record<string, number>;
  replayableCount: number;
}

/**
 * Roll up all lineage events into a summary: total count, by event type, by
 * actor type, and the count of events carrying a replay token.
 */
export async function getLineageSummary(): Promise<LineageSummary> {
  return cached('lineage:summary', TTL.MEDIUM, async () => {
    const events = await safeFindMany(() => db.dataLineageEvent.findMany({ take: 5000 }));
    return {
      totalEvents: events.length,
      byEventType: countBy(events, (e) => e.eventType),
      byActorType: countBy(events, (e) => e.actorType),
      replayableCount: events.filter((e) => Boolean(e.replayToken)).length,
    };
  });
}

// ─── 4. replayLineageEvent ────────────────────────────────────────────────────

export interface LineageReplay {
  event: DataLineageEvent | null;
  replayable: boolean;
  snapshot: Record<string, unknown> | null;
}

/**
 * Look up an event by its replayToken and return a read-only replay: the mapped
 * event plus its recorded afterSnapshot. If the token is unknown, returns
 * { event: null, replayable: false, snapshot: null }.
 */
export async function replayLineageEvent(replayToken: string): Promise<LineageReplay> {
  const row = await safeAggregate(() =>
    db.dataLineageEvent.findUnique({ where: { replayToken } }),
  );
  if (!row) {
    return { event: null, replayable: false, snapshot: null };
  }
  const event = mapLineageEvent(row);
  const snapshot = parseJson<Record<string, unknown>>(row.afterSnapshot, {});
  return { event, replayable: true, snapshot };
}
