// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Intelligence Core™ — Self-Improvement Engine™
// Oracle learns from accepted/rejected recommendations, successful/failed
// automations, revenue growth, customer behavior, collections, expenses, and
// compliance. Every lesson is weighted, applied, and reinforced or decayed.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { LearningCategory, LearningRecord } from './types';

const FIRM_ID = process.env.NEXT_PUBLIC_FIRM_ID || 'gstpilot-default-firm';

// ─── Serialization ──────────────────────────────────────────────────────────

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
  category: string;
  signal: string;
  evidence: string;
  lessonLearned: string;
  weight: number;
  appliedCount: number;
  successCount: number;
  createdAt: Date;
  lastAppliedAt: Date | null;
}): LearningRecord {
  return {
    id: r.id,
    firmId: r.firmId,
    category: r.category as LearningCategory,
    signal: r.signal,
    evidence: safeParseJSON<Record<string, unknown>>(r.evidence, {}),
    lessonLearned: r.lessonLearned,
    weight: r.weight,
    appliedCount: r.appliedCount,
    successCount: r.successCount,
    createdAt: r.createdAt.toISOString(),
    lastAppliedAt: r.lastAppliedAt ? r.lastAppliedAt.toISOString() : null,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface RecordLearningInput {
  firmId?: string;
  category: LearningCategory;
  signal: string;
  evidence: Record<string, unknown>;
  lessonLearned: string;
  weight?: number;
}

/** Record a new learning. Used by every AI module whenever a recommendation is accepted/rejected,
 *  an automation succeeds/fails, or a business pattern is observed. */
export async function recordLearning(input: RecordLearningInput): Promise<LearningRecord> {
  const firmId = input.firmId || FIRM_ID;
  const created = await db.oracleLearning.create({
    data: {
      firmId,
      category: input.category,
      signal: input.signal,
      evidence: JSON.stringify(input.evidence ?? {}),
      lessonLearned: input.lessonLearned,
      weight: input.weight ?? 1.0,
    },
  });
  return serialize(created);
}

export interface LearningStats {
  totalLessons: number;
  appliedRecently: number;
  topLessons: LearningRecord[];
}

/** Aggregate learning statistics for VEYRO AI dashboard. */
export async function getLearningStats(): Promise<LearningStats> {
  const firmId = FIRM_ID;
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [total, appliedRecently, topRows] = await Promise.all([
    db.oracleLearning.count({ where: { firmId } }),
    db.oracleLearning.count({
      where: { firmId, lastAppliedAt: { gte: since7d } },
    }),
    db.oracleLearning.findMany({
      where: { firmId },
      orderBy: [{ weight: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    }),
  ]);

  // Score = weight * (successCount / max(appliedCount, 1)); top 5
  const scored = topRows
    .map((r) => ({
      record: serialize(r),
      score: r.weight * (r.appliedCount > 0 ? r.successCount / r.appliedCount : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    totalLessons: total,
    appliedRecently,
    topLessons: scored.map((s) => s.record),
  };
}

/** Apply (reinforce or decay) a lesson. Adjusts weight via exponential reinforcement. */
export async function applyLesson(id: string, success: boolean): Promise<void> {
  const existing = await db.oracleLearning.findUnique({ where: { id } });
  if (!existing) return;

  const newAppliedCount = existing.appliedCount + 1;
  const newSuccessCount = existing.successCount + (success ? 1 : 0);
  // Reinforcement: success → +5% (cap 5.0); failure → −5% (floor 0.1).
  const newWeight = Math.min(
    5.0,
    Math.max(0.1, existing.weight * (success ? 1.05 : 0.95)),
  );

  await db.oracleLearning.update({
    where: { id },
    data: {
      appliedCount: newAppliedCount,
      successCount: newSuccessCount,
      weight: newWeight,
      lastAppliedAt: new Date(),
    },
  });
}

/** Retrieve the top lessons for a given category, sorted by weight desc. */
export async function getRelevantLessons(
  category: LearningCategory,
  limit = 10,
): Promise<LearningRecord[]> {
  const firmId = FIRM_ID;
  const rows = await db.oracleLearning.findMany({
    where: { firmId, category },
    orderBy: [{ weight: 'desc' }, { createdAt: 'desc' }],
    take: Math.min(limit, 100),
  });
  return rows.map(serialize);
}

export interface LessonSynthesis {
  summary: string;
  topPatterns: string[];
}

/** Synthesize all lessons across categories into a human-readable insight.
 *  Each category is summarized: count, success rate, dominant pattern. */
export async function synthesizeLessons(): Promise<LessonSynthesis> {
  const firmId = FIRM_ID;
  const all = await db.oracleLearning.findMany({
    where: { firmId },
    orderBy: [{ weight: 'desc' }],
  });

  if (all.length === 0) {
    return {
      summary: 'No lessons recorded yet. Oracle will learn as recommendations are accepted/rejected and automations run.',
      topPatterns: [],
    };
  }

  // Group by category
  const groups = new Map<LearningCategory, typeof all>();
  for (const r of all) {
    const cat = r.category as LearningCategory;
    const arr = groups.get(cat) ?? [];
    arr.push(r);
    groups.set(cat, arr);
  }

  const topPatterns: string[] = [];
  const categoryLines: string[] = [];

  for (const [category, rows] of groups) {
    const count = rows.length;
    const totalApplied = rows.reduce((s, r) => s + r.appliedCount, 0);
    const totalSuccess = rows.reduce((s, r) => s + r.successCount, 0);
    const successRate = totalApplied > 0 ? Math.round((totalSuccess / totalApplied) * 100) : 0;
    const avgWeight =
      Math.round((rows.reduce((s, r) => s + r.weight, 0) / count) * 100) / 100;

    // Dominant pattern: pick the highest-weight lesson's signal as the representative pattern.
    const top = rows[0];
    const patternLine = `${count} ${category} lessons: ${successRate}% success rate (avg weight ${avgWeight}). Top signal: "${top.signal}" → ${top.lessonLearned}`;
    topPatterns.push(patternLine);
    categoryLines.push(`- ${category}: ${count} lessons, ${successRate}% success rate, avg weight ${avgWeight}`);
  }

  const summary = [
    `Oracle has internalized ${all.length} lessons across ${groups.size} categories.`,
    '',
    'Category breakdown:',
    ...categoryLines,
    '',
    'Top patterns:',
    ...topPatterns.slice(0, 5).map((p, i) => `${i + 1}. ${p}`),
  ].join('\n');

  return {
    summary,
    topPatterns: topPatterns.slice(0, 10),
  };
}

/** Fetch a single learning record by id (used by the audit/insights modules). */
export async function getLesson(id: string): Promise<LearningRecord | null> {
  const row = await db.oracleLearning.findUnique({ where: { id } });
  return row ? serialize(row) : null;
}

/** List all lessons (paginated) — used by the learning explorer UI. */
export async function listLessons(limit = 100, offset = 0): Promise<LearningRecord[]> {
  const firmId = FIRM_ID;
  const rows = await db.oracleLearning.findMany({
    where: { firmId },
    orderBy: [{ weight: 'desc' }, { createdAt: 'desc' }],
    take: Math.min(limit, 500),
    skip: Math.max(0, offset),
  });
  return rows.map(serialize);
}
