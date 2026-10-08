// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Learning Engine (PROMPT 6)
//
// Auto-learning from user behaviour. Oracle notices when the user repeatedly
// edits reports, always exports PDF, ignores certain advice, prefers short
// responses, or frequently asks the same query. These learnings are fed back
// into the system prompt so Oracle adapts to each user.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { BrainLearning, LearningSignal } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface LearningRow {
  id: string;
  firmId: string;
  userId: string | null;
  signal: string;
  pattern: string;
  observation: string;
  weight: number;
  occurrenceCount: number;
  metadata: string;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: LearningRow): BrainLearning {
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
    signal: row.signal as LearningSignal,
    pattern: row.pattern,
    observation: row.observation,
    weight: row.weight,
    occurrenceCount: row.occurrenceCount,
    metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface RecordLearningInput {
  firmId: string;
  userId?: string;
  signal: LearningSignal;
  pattern: string;
  observation?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Record (or reinforce) a learning. On conflict (same firmId+userId+signal+pattern),
 * increment occurrenceCount, bump weight by 0.1 (cap 5.0), and update observation.
 */
export async function recordLearning(
  input: RecordLearningInput,
): Promise<BrainLearning> {
  try {
    const existing = await db.oracleBrainLearning.findFirst({
      where: {
        firmId: input.firmId,
        userId: input.userId ?? null,
        signal: input.signal,
        pattern: input.pattern,
      },
    });

    if (existing) {
      const newWeight = Math.min(5.0, existing.weight + 0.1);
      const row = await db.oracleBrainLearning.update({
        where: { id: existing.id },
        data: {
          weight: newWeight,
          occurrenceCount: { increment: 1 },
          ...(input.observation ? { observation: input.observation } : {}),
          ...(input.metadata
            ? {
                metadata: JSON.stringify({
                  ...(existing.metadata ? safeParse(existing.metadata) : {}),
                  ...input.metadata,
                }),
              }
            : {}),
        },
      });
      return mapRow(row as unknown as LearningRow);
    }

    const row = await db.oracleBrainLearning.create({
      data: {
        firmId: input.firmId,
        userId: input.userId ?? null,
        signal: input.signal,
        pattern: input.pattern,
        observation: input.observation ?? '',
        weight: 1.0,
        occurrenceCount: 1,
        metadata: JSON.stringify(input.metadata ?? {}),
      },
    });
    return mapRow(row as unknown as LearningRow);
  } catch (err) {
    throw new Error(
      `recordLearning failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s || '{}');
  } catch {
    return {};
  }
}

/** Fetch one learning. */
export async function getLearning(id: string): Promise<BrainLearning | null> {
  try {
    const row = await db.oracleBrainLearning.findUnique({ where: { id } });
    return row ? mapRow(row as unknown as LearningRow) : null;
  } catch (err) {
    throw new Error(
      `getLearning failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** List learnings. */
export async function listLearnings(opts: {
  firmId: string;
  signal?: LearningSignal;
  limit?: number;
}): Promise<BrainLearning[]> {
  try {
    const where: Record<string, unknown> = { firmId: opts.firmId };
    if (opts.signal) where.signal = opts.signal;
    const rows = await db.oracleBrainLearning.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: (opts.limit ?? 20) * 2,
    });
    const mapped = rows.map((r) => mapRow(r as unknown as LearningRow));
    mapped.sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      if (b.occurrenceCount !== a.occurrenceCount) return b.occurrenceCount - a.occurrenceCount;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return mapped.slice(0, opts.limit ?? 20);
  } catch (err) {
    throw new Error(
      `listLearnings failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Top learnings by weight — injected into Oracle's system prompt. */
export async function getLearnedPreferences(
  firmId: string,
): Promise<BrainLearning[]> {
  return listLearnings({ firmId, limit: 10 });
}

export type BehaviorEvent =
  | 'edit_report'
  | 'export_pdf'
  | 'ignore_advice'
  | 'short_response_preferred'
  | 'long_response_preferred'
  | 'language_change'
  | 'frequent_query';

/**
 * Map a UI behaviour event to a learning signal and record it.
 * Returns the recorded learning, or null if the event type is unknown.
 */
export async function inferPreferencesFromBehavior(
  firmId: string,
  userId: string,
  event: { kind: BehaviorEvent; detail?: string },
): Promise<BrainLearning | null> {
  let signal: LearningSignal | null = null;
  let pattern = '';
  let observation = '';

  switch (event.kind) {
    case 'edit_report':
      signal = 'edits_report';
      pattern = 'edits_generated_reports';
      observation = 'User edits reports after generation — consider more draft-like output.';
      break;
    case 'export_pdf':
      signal = 'exports_pdf';
      pattern = 'exports_to_pdf';
      observation = 'User frequently exports to PDF — surface export action prominently.';
      break;
    case 'ignore_advice':
      signal = 'ignores_advice';
      pattern = `ignored:${event.detail || 'recommendation'}`;
      observation = 'User ignored a recommendation — lower priority of similar advice.';
      break;
    case 'short_response_preferred':
      signal = 'prefers_short';
      pattern = 'prefers_concise_responses';
      observation = 'User prefers concise responses — keep answers short.';
      break;
    case 'long_response_preferred':
      signal = 'prefers_short';
      pattern = 'prefers_detailed_responses';
      observation = 'User prefers detailed responses — expand analysis.';
      break;
    case 'language_change':
      signal = 'prefers_language';
      pattern = `language:${event.detail || 'unknown'}`;
      observation = `User prefers responses in ${event.detail || 'a specific language'}.`;
      break;
    case 'frequent_query':
      signal = 'frequent_query';
      pattern = `query:${(event.detail || '').slice(0, 60)}`;
      observation = 'User asks this query frequently — consider proactively surfacing the answer.';
      break;
    default:
      return null;
  }

  return recordLearning({ firmId, userId, signal, pattern, observation });
}

/** Aggregate learning stats. */
export async function getLearningStats(
  firmId: string,
): Promise<{
  total: number;
  bySignal: Record<string, number>;
  topPatterns: { pattern: string; signal: string; weight: number; occurrenceCount: number }[];
}> {
  try {
    const rows = await db.oracleBrainLearning.findMany({
      where: { firmId },
      select: { signal: true, pattern: true, weight: true, occurrenceCount: true },
    });
    const bySignal: Record<string, number> = {};
    for (const r of rows) {
      bySignal[r.signal] = (bySignal[r.signal] ?? 0) + 1;
    }
    const topPatterns = rows
      .map((r) => ({
        pattern: r.pattern,
        signal: r.signal,
        weight: r.weight,
        occurrenceCount: r.occurrenceCount,
      }))
      .sort((a, b) => b.weight - a.weight || b.occurrenceCount - a.occurrenceCount)
      .slice(0, 10);
    return { total: rows.length, bySignal, topPatterns };
  } catch (err) {
    throw new Error(
      `getLearningStats failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
