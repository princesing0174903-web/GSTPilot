// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE EXECUTION CLOUD™ — Subsystem 4: SMART EXECUTION QUEUE™
// Every execution enters a priority queue. Supports priority, scheduling,
// retries, delays, dependencies, rollback, human approval, parallel execution,
// distributed workers.
// ═══════════════════════════════════════════════════════════════════════════════

import type { PrismaClient } from '@prisma/client';
import type { ExecutionJob, ExecutionQueueEntry, QueueStatus, QueueSummary } from './types';

const PRIORITY_RANK: Record<string, number> = {
  critical: 0, high: 25, normal: 50, low: 75, deferred: 100,
};

// Derive queue entries from the job stream + explicit ExecutionQueue rows.
export async function buildQueues(
  db: PrismaClient,
  jobs: ExecutionJob[],
): Promise<{ entries: ExecutionQueueEntry[]; summaries: QueueSummary[] }> {
  // 1. Explicit queue rows.
  const rows = await db.executionQueue.findMany({ take: 500, orderBy: { enqueuedAt: 'desc' } });
  const explicit = new Map<string, ExecutionQueueEntry>();
  for (const r of rows) {
    explicit.set(r.jobId, {
      id: r.id,
      queueName: r.queueName,
      jobId: r.jobId,
      priority: r.priority,
      scheduledFor: r.scheduledFor ? r.scheduledFor.toISOString() : null,
      status: r.status as QueueStatus,
      dependencies: safeParseArr(r.dependencies),
      workerId: r.workerId,
      enqueuedAt: r.enqueuedAt.toISOString(),
      startedAt: r.startedAt ? r.startedAt.toISOString() : null,
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    });
  }

  // 2. Derive queue entries for jobs not already in an explicit queue row.
  const derived: ExecutionQueueEntry[] = [];
  for (const j of jobs) {
    if (explicit.has(j.id)) continue;
    derived.push({
      id: `q-${j.id}`,
      queueName: j.queueName,
      jobId: j.id,
      priority: PRIORITY_RANK[j.priority] ?? 50,
      scheduledFor: null,
      status: mapStatusToQueue(j.status),
      dependencies: j.sourceJobId ? [j.sourceJobId] : [],
      workerId: j.workerId,
      enqueuedAt: j.createdAt,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
    });
  }

  const entries = [...explicit.values(), ...derived];

  // 3. Summaries per queue.
  const byQueue = new Map<string, ExecutionQueueEntry[]>();
  for (const e of entries) {
    const arr = byQueue.get(e.queueName) ?? [];
    arr.push(e);
    byQueue.set(e.queueName, arr);
  }
  const summaries: QueueSummary[] = [];
  for (const [queueName, list] of byQueue) {
    let queued = 0, running = 0, completed = 0, failed = 0, delayed = 0, awaitingApproval = 0;
    let oldest: number | null = null;
    let waitSum = 0;
    let waitCount = 0;
    for (const e of list) {
      switch (e.status) {
        case 'queued': queued += 1; break;
        case 'running': running += 1; break;
        case 'completed': completed += 1; break;
        case 'failed': failed += 1; break;
        case 'delayed': delayed += 1; break;
        case 'awaiting_approval': awaitingApproval += 1; break;
      }
      const enq = new Date(e.enqueuedAt).getTime();
      if (oldest === null || enq < oldest) oldest = enq;
      if (e.startedAt) {
        waitSum += new Date(e.startedAt).getTime() - enq;
        waitCount += 1;
      }
    }
    summaries.push({
      queueName,
      total: list.length,
      queued, running, completed, failed, delayed, awaitingApproval,
      oldestQueuedAt: oldest ? new Date(oldest).toISOString() : null,
      avgWaitMs: waitCount > 0 ? Math.round(waitSum / waitCount) : 0,
    });
  }
  summaries.sort((a, b) => b.total - a.total);

  return { entries, summaries };
}

function mapStatusToQueue(s: ExecutionJob['status']): QueueStatus {
  switch (s) {
    case 'queued': return 'queued';
    case 'running': return 'running';
    case 'completed': return 'completed';
    case 'failed': return 'failed';
    case 'awaiting_approval': return 'awaiting_approval';
    case 'cancelled': return 'cancelled';
    default: return 'queued';
  }
}

function safeParseArr(s: string | null): string[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}
