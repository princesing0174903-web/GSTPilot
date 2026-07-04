// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE EXECUTION CLOUD™ — DASHBOARD AGGREGATOR
// Single entry point: getExecutionDashboard(db) returns the full Execution
// Cloud state by composing all 14 subsystems. This is what
// GET /api/execution/dashboard returns. Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { PrismaClient } from '@prisma/client';
import type { ExecutionDashboard, ExecutionJob, WorkerType, WorkerStatus } from './types';
import { buildUnifiedJobStream, rollupPipeline, buildOracleNarrative } from './engine';
import { buildTimeline } from './timeline';
import { buildTaskGraph } from './task-graph';
import { buildQueues } from './queue';
import { buildWorkers } from './workers';
import { computeObservability } from './observability';
import { buildAlerts } from './alerts';
import { buildLiveMap } from './live-map';
import { computeAnalytics } from './analytics';
import { buildSchedules } from './schedules';

export async function getExecutionDashboard(db: PrismaClient): Promise<ExecutionDashboard> {
  // 1. Unified job stream — the single source of truth.
  const jobs: ExecutionJob[] = await buildUnifiedJobStream(db);

  // 2. Pipeline rollup (totals + byModule + byPriority + byStatus).
  const { totals, byModule, byPriority, byStatus } = rollupPipeline(jobs);

  // 3. Subsystems — computed in parallel where independent.
  const { roster, total: workerTotal, active, avgUtilizationPct } = await buildWorkers(db, jobs);
  const { summaries: queues } = await buildQueues(db, jobs);
  const taskGraph = await buildTaskGraph(db, jobs);
  const alerts = await buildAlerts(db, jobs, totals.queued);
  const schedules = await buildSchedules(db);

  const timeline = buildTimeline(jobs);
  const observability = computeObservability(jobs, totals.queued, avgUtilizationPct);
  const analytics = computeAnalytics(jobs);
  const liveMap = buildLiveMap(jobs, roster);

  const workersByType = {} as Record<WorkerType, number>;
  const workersByStatus = {} as Record<WorkerStatus, number>;
  for (const t of ['local','distributed','edge','regional','country','ai','connector','software_factory'] as WorkerType[]) workersByType[t] = 0;
  for (const s of ['idle','busy','offline','draining'] as WorkerStatus[]) workersByStatus[s] = 0;
  for (const w of roster) {
    workersByType[w.type] = (workersByType[w.type] ?? 0) + 1;
    workersByStatus[w.status] = (workersByStatus[w.status] ?? 0) + 1;
  }

  const oracleNarrative = buildOracleNarrative(jobs, totals, workerTotal, alerts.open);

  return {
    totals,
    byModule,
    byPriority,
    byStatus,
    timeline,
    taskGraph,
    queues,
    workers: {
      total: workerTotal,
      active,
      byType: workersByType,
      byStatus: workersByStatus,
      avgUtilizationPct,
      roster,
    },
    observability,
    alerts,
    analytics,
    liveMap,
    schedules,
    oracleNarrative,
    updatedAt: new Date().toISOString(),
  };
}
