// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Oracle Intelligence Engine™
// The Financial Brain of India™
//
// The single entry point: `generateOracleBriefing(userId)`.
//
// Flow:
//   1. Resolve the user's organization context (from GoogleWorkspaceToken).
//   2. Run every registered Collector in parallel → CollectedDataset.
//   3. Run every registered Analyzer in parallel over the dataset → signals + metrics.
//   4. Rank all signals by importance (severity × monetary × urgency × confidence × category).
//   5. Assemble the final structured OracleBriefing JSON.
//
// Contracts:
//   • Never throws. Collector/analyzer failures are captured per-source and
//     surfaced in the briefing's `sources[].error` field.
//   • No demo data. Every number comes from a real DB row or a real Google API call.
//   • Modular. New data sources plug in by adding to COLLECTORS / ANALYZERS arrays.
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';

import { db } from '@/lib/db';
import { ANALYZERS } from './analyzers';
import { assembleBriefing } from './briefing';
import { COLLECTORS } from './collectors';
import { rankSignals } from './ranking';
import type {
  AnalyzerResult,
  CollectedDataset,
  CollectorContext,
  CollectorResult,
  OracleBriefing,
  Signal,
} from './types';

// ─── Organization resolution ──────────────────────────────────────────────────

/**
 * Resolve the organization id + email for a user by looking up their stored
 * Google Workspace token. Returns { organizationId: null, userEmail: null }
 * if the user has no Google Workspace connection — business-data collectors
 * still run (they query the firm-wide Prisma tables).
 */
async function resolveOrgContext(userId: string): Promise<{
  organizationId: string | null;
  userEmail: string | null;
}> {
  if (!userId) return { organizationId: null, userEmail: null };
  try {
    const token = await db.googleWorkspaceToken.findFirst({
      where: { userId, revokedAt: null },
    });
    if (!token) return { organizationId: null, userEmail: null };
    return { organizationId: token.organizationId, userEmail: token.userEmail };
  } catch {
    return { organizationId: null, userEmail: null };
  }
}

// ─── Collector runner ─────────────────────────────────────────────────────────

/**
 * Run a single collector with a defensive try/catch. A throwing collector
 * becomes a disconnected source with an error message — it never breaks the
 * whole briefing.
 */
async function runCollectorSafe(
  collectorId: string,
  collectFn: (ctx: CollectorContext) => Promise<CollectorResult<unknown>>,
  ctx: CollectorContext,
): Promise<CollectorResult<unknown>> {
  try {
    return await collectFn(ctx);
  } catch (err) {
    return {
      source: collectorId,
      connected: false,
      recordCount: 0,
      data: {},
      error: err instanceof Error ? err.message : `Collector ${collectorId} failed.`,
      collectedAt: new Date().toISOString(),
    };
  }
}

/**
 * Run all registered collectors in parallel. Returns a dataset keyed by
 * collector id.
 */
async function runAllCollectors(ctx: CollectorContext): Promise<CollectedDataset> {
  const entries = await Promise.all(
    COLLECTORS.map(async (c) => {
      const result = await runCollectorSafe(c.id, c.collect, ctx);
      return [c.id, result] as const;
    }),
  );
  return Object.fromEntries(entries);
}

// ─── Analyzer runner ──────────────────────────────────────────────────────────

/**
 * Run a single analyzer defensively. A throwing analyzer contributes no
 * signals and an empty metrics map — it never breaks the briefing.
 */
async function runAnalyzerSafe(
  analyzerId: string,
  analyzeFn: (dataset: CollectedDataset) => AnalyzerResult | Promise<AnalyzerResult>,
  dataset: CollectedDataset,
): Promise<AnalyzerResult> {
  try {
    return await analyzeFn(dataset);
  } catch (err) {
    return {
      analyzer: analyzerId,
      signals: [],
      metrics: {},
    };
  }
}

/**
 * Run all registered analyzers in parallel. Returns the merged signal list
 * and a per-analyzer metrics map.
 */
async function runAllAnalyzers(dataset: CollectedDataset): Promise<{
  signals: Signal[];
  analyzerMetrics: Record<string, Record<string, number>>;
}> {
  const results = await Promise.all(
    ANALYZERS.map((a) => runAnalyzerSafe(a.id, a.analyze, dataset)),
  );
  const signals: Signal[] = [];
  const analyzerMetrics: Record<string, Record<string, number>> = {};
  for (const r of results) {
    signals.push(...r.signals);
    analyzerMetrics[r.analyzer] = r.metrics;
  }
  return { signals, analyzerMetrics };
}

// ─── Collector labels (for the Sources panel) ────────────────────────────────

function collectorLabels(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of COLLECTORS) out[c.id] = c.label;
  return out;
}

// ─── Public API: the one function the engine exposes ──────────────────────────

/**
 * Generate a structured Oracle briefing for the given user.
 *
 * @param userId — Firebase Auth uid of the requesting user.
 * @returns OracleBriefing — always defined, never throws.
 */
export async function generateOracleBriefing(userId: string): Promise<OracleBriefing> {
  // 1. Resolve org context (for Google Workspace collectors).
  const { organizationId, userEmail } = await resolveOrgContext(userId);
  const ctx: CollectorContext = { userId, organizationId, userEmail };

  // 2. Collect all data sources in parallel.
  const dataset = await runAllCollectors(ctx);

  // 3. Analyze in parallel.
  const { signals, analyzerMetrics } = await runAllAnalyzers(dataset);

  // 4. Rank by importance.
  const ranked = rankSignals(signals);

  // 4a. Fetch the canonical Health Score from the centralized Business
  // Snapshot. The Oracle briefing is the same score shown on the Home
  // Dashboard / AI CFO / Run Business (see AUDIT-DUP-1 + task HEALTH-ENGINE).
  // Falls back to the signal-based score if the snapshot is unavailable.
  let canonicalHealthScore: number | undefined;
  if (organizationId) {
    try {
      const { getBusinessSnapshot } = await import('@/lib/business/snapshot');
      const snapshot = await getBusinessSnapshot(organizationId);
      // Only override if the snapshot has real data — a snapshot that returns
      // 0 with no revenue/cash means the org has no Prisma data, so the
      // signal-based fallback is more meaningful.
      if (snapshot.healthScore > 0 || snapshot.revenue > 0 || snapshot.cash > 0) {
        canonicalHealthScore = snapshot.healthScore;
      }
    } catch {
      // Swallow — fall back to the signal-based score.
    }
  }

  // 5. Assemble the final briefing.
  const briefing = assembleBriefing({
    userId,
    dataset,
    signals: ranked,
    analyzerMetrics,
    collectorLabels: collectorLabels(),
    canonicalHealthScore,
  });

  return briefing;
}

// ─── Re-exports for downstream consumers ──────────────────────────────────────

export type {
  OracleBriefing,
  Signal,
  RankedSignal,
  CollectorContext,
  CollectorResult,
  Collector,
  Analyzer,
  AnalyzerResult,
  CollectedDataset,
} from './types';

export { COLLECTORS } from './collectors';
export { ANALYZERS } from './analyzers';
export { rankSignals } from './ranking';
