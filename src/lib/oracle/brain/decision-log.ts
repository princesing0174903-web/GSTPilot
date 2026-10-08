// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Decision Log (PROMPT 6)
//
// Explainable decision tracking. Every Oracle recommendation is logged with
// reason + evidence + expected outcome + confidence. The lifecycle tracks
// recommended → accepted/rejected → implemented → outcome measured.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { BrainDecision, DecisionStatus, DecisionOutcome } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

interface DecisionRow {
  id: string;
  firmId: string;
  userId: string | null;
  title: string;
  recommendation: string;
  reason: string;
  evidence: string;
  expectedOutcome: string;
  confidence: number;
  priority: string;
  status: string;
  outcome: string | null;
  outcomeNote: string | null;
  decidedAt: Date | null;
  implementedAt: Date | null;
  sourceMemoryId: string | null;
  metadata: string;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: DecisionRow): BrainDecision {
  let evidence: string[] = [];
  try {
    evidence = JSON.parse(row.evidence || '[]');
  } catch {
    evidence = [];
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
    title: row.title,
    recommendation: row.recommendation,
    reason: row.reason,
    evidence,
    expectedOutcome: row.expectedOutcome,
    confidence: row.confidence,
    priority: row.priority as 'P0' | 'P1' | 'P2' | 'P3',
    status: row.status as DecisionStatus,
    outcome: (row.outcome as DecisionOutcome | null) ?? null,
    outcomeNote: row.outcomeNote,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    implementedAt: row.implementedAt?.toISOString() ?? null,
    sourceMemoryId: row.sourceMemoryId,
    metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function sortDecisions(decisions: BrainDecision[]): BrainDecision[] {
  return decisions.sort((a, b) => {
    const pr = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
    if (pr !== 0) return pr;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface LogDecisionInput {
  firmId: string;
  userId?: string;
  title: string;
  recommendation: string;
  reason: string;
  evidence?: string[];
  expectedOutcome?: string;
  confidence?: number;
  priority?: 'P0' | 'P1' | 'P2' | 'P3';
  sourceMemoryId?: string;
  metadata?: Record<string, unknown>;
}

/** Log a new recommendation as a decision record. */
export async function logDecision(input: LogDecisionInput): Promise<BrainDecision> {
  try {
    const row = await db.oracleBrainDecision.create({
      data: {
        firmId: input.firmId,
        userId: input.userId ?? null,
        title: input.title,
        recommendation: input.recommendation,
        reason: input.reason,
        evidence: JSON.stringify(input.evidence ?? []),
        expectedOutcome: input.expectedOutcome ?? '',
        confidence: input.confidence ?? 50,
        priority: input.priority ?? 'P2',
        status: 'recommended',
        sourceMemoryId: input.sourceMemoryId ?? null,
        metadata: JSON.stringify(input.metadata ?? {}),
      },
    });
    return mapRow(row as unknown as DecisionRow);
  } catch (err) {
    throw new Error(
      `logDecision failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Patch a decision record. */
export async function updateDecision(
  id: string,
  patch: Partial<{
    status: DecisionStatus;
    outcome: DecisionOutcome;
    outcomeNote: string;
    decidedAt: Date;
    implementedAt: Date;
  }>,
): Promise<BrainDecision> {
  try {
    const data: Record<string, unknown> = {};
    if (patch.status !== undefined) {
      data.status = patch.status;
      if ((patch.status === 'accepted' || patch.status === 'rejected') && !patch.decidedAt) {
        data.decidedAt = new Date();
      }
      if (patch.status === 'implemented' && !patch.implementedAt) {
        data.implementedAt = new Date();
      }
    }
    if (patch.outcome !== undefined) data.outcome = patch.outcome;
    if (patch.outcomeNote !== undefined) data.outcomeNote = patch.outcomeNote;
    if (patch.decidedAt !== undefined) data.decidedAt = patch.decidedAt;
    if (patch.implementedAt !== undefined) data.implementedAt = patch.implementedAt;
    const row = await db.oracleBrainDecision.update({ where: { id }, data });
    return mapRow(row as unknown as DecisionRow);
  } catch (err) {
    throw new Error(
      `updateDecision failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Fetch one decision. */
export async function getDecision(id: string): Promise<BrainDecision | null> {
  try {
    const row = await db.oracleBrainDecision.findUnique({ where: { id } });
    return row ? mapRow(row as unknown as DecisionRow) : null;
  } catch (err) {
    throw new Error(
      `getDecision failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** List decisions with filters. */
export async function listDecisions(opts: {
  firmId: string;
  status?: DecisionStatus;
  priority?: string;
  limit?: number;
  offset?: number;
}): Promise<BrainDecision[]> {
  try {
    const where: Record<string, unknown> = { firmId: opts.firmId };
    if (opts.status) where.status = opts.status;
    if (opts.priority) where.priority = opts.priority;
    const rows = await db.oracleBrainDecision.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: (opts.limit ?? 30) * 3,
      skip: opts.offset ?? 0,
    });
    return sortDecisions(rows.map((r) => mapRow(r as unknown as DecisionRow))).slice(
      0,
      opts.limit ?? 30,
    );
  } catch (err) {
    throw new Error(
      `listDecisions failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Open decisions (status=recommended). */
export async function getOpenDecisions(
  firmId: string,
  limit = 10,
): Promise<BrainDecision[]> {
  try {
    const rows = await db.oracleBrainDecision.findMany({
      where: { firmId, status: 'recommended' },
      orderBy: { createdAt: 'desc' },
      take: limit * 3,
    });
    return sortDecisions(rows.map((r) => mapRow(r as unknown as DecisionRow))).slice(
      0,
      limit,
    );
  } catch (err) {
    throw new Error(
      `getOpenDecisions failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Mark a decision accepted. */
export async function markAccepted(
  id: string,
  outcomeNote?: string,
): Promise<BrainDecision> {
  return updateDecision(id, {
    status: 'accepted',
    decidedAt: new Date(),
    ...(outcomeNote ? { outcomeNote } : {}),
  });
}

/** Mark a decision rejected. */
export async function markRejected(
  id: string,
  outcomeNote?: string,
): Promise<BrainDecision> {
  return updateDecision(id, {
    status: 'rejected',
    decidedAt: new Date(),
    ...(outcomeNote ? { outcomeNote } : {}),
  });
}

/** Mark a decision implemented with an outcome. */
export async function markImplemented(
  id: string,
  outcome: DecisionOutcome,
  outcomeNote?: string,
): Promise<BrainDecision> {
  return updateDecision(id, {
    status: 'implemented',
    implementedAt: new Date(),
    outcome,
    ...(outcomeNote ? { outcomeNote } : {}),
  });
}

/** Aggregate decision stats. */
export async function getDecisionStats(
  firmId: string,
): Promise<{
  total: number;
  recommended: number;
  accepted: number;
  rejected: number;
  implemented: number;
  avgConfidence: number;
}> {
  try {
    const rows = await db.oracleBrainDecision.findMany({
      where: { firmId },
      select: { status: true, confidence: true },
    });
    const counts = { recommended: 0, accepted: 0, rejected: 0, implemented: 0 };
    let confSum = 0;
    for (const r of rows) {
      if (r.status in counts) counts[r.status as keyof typeof counts]++;
      confSum += r.confidence;
    }
    return {
      total: rows.length,
      ...counts,
      avgConfidence: rows.length ? Math.round(confSum / rows.length) : 0,
    };
  } catch (err) {
    throw new Error(
      `getDecisionStats failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
