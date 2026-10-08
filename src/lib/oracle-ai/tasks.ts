// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ Intelligence Layer — Task Queue Manager
//
// CRUD for the AI Task Queue. Tasks are background jobs (research, report
// generation, batch processing, agent runs) that are enqueued by tools or by
// the user. The engine does not currently run a polling worker — tasks are
// executed synchronously when created via the `runTask` function (Phase 2 will
// add a real worker). For now, `runTask` resolves the task inline and updates
// its status.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { OracleAITask, TaskStatus, TaskType } from './types';

const FIRM_ID = process.env.NEXT_PUBLIC_FIRM_ID || 'gstpilot-default-firm';

function serializeTask(r: {
  id: string;
  firmId: string;
  userId: string | null;
  sessionId: string | null;
  messageId: string | null;
  type: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  progress: number;
  payload: string;
  result: string | null;
  error: string | null;
  agentId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): OracleAITask {
  let payload: Record<string, unknown> = {};
  let result: unknown = null;
  try {
    payload = JSON.parse(r.payload) as Record<string, unknown>;
  } catch {
    payload = {};
  }
  try {
    result = r.result ? JSON.parse(r.result) : null;
  } catch {
    result = null;
  }
  return {
    id: r.id,
    firmId: r.firmId,
    userId: r.userId,
    sessionId: r.sessionId,
    messageId: r.messageId,
    type: r.type as TaskType,
    title: r.title,
    description: r.description,
    status: r.status as TaskStatus,
    priority: r.priority,
    progress: r.progress,
    payload,
    result,
    error: r.error,
    agentId: r.agentId,
    startedAt: r.startedAt ? r.startedAt.toISOString() : null,
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function enqueueTask(input: {
  firmId?: string;
  userId?: string | null;
  sessionId?: string | null;
  messageId?: string | null;
  type: TaskType;
  title: string;
  description?: string;
  priority?: number;
  payload?: Record<string, unknown>;
  agentId?: string | null;
}): Promise<OracleAITask> {
  const firmId = input.firmId || FIRM_ID;
  const row = await db.oracleAITask.create({
    data: {
      firmId,
      userId: input.userId ?? null,
      sessionId: input.sessionId ?? null,
      messageId: input.messageId ?? null,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      status: 'queued',
      priority: Math.max(1, Math.min(10, input.priority ?? 5)),
      payload: JSON.stringify(input.payload ?? {}),
      agentId: input.agentId ?? null,
    },
  });
  return serializeTask(row);
}

export async function listTasks(input: {
  firmId?: string;
  status?: TaskStatus;
  sessionId?: string;
  limit?: number;
}): Promise<OracleAITask[]> {
  const firmId = input.firmId || FIRM_ID;
  const limit = Math.min(200, input.limit ?? 50);
  const where: { firmId: string; status?: string; sessionId?: string } = { firmId };
  if (input.status) where.status = input.status;
  if (input.sessionId) where.sessionId = input.sessionId;
  const rows = await db.oracleAITask.findMany({
    where,
    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  });
  return rows.map(serializeTask);
}

export async function getTask(taskId: string, firmId: string = FIRM_ID): Promise<OracleAITask | null> {
  const row = await db.oracleAITask.findFirst({ where: { id: taskId, firmId } });
  return row ? serializeTask(row) : null;
}

export async function updateTask(
  taskId: string,
  input: {
    status?: TaskStatus;
    progress?: number;
    result?: unknown;
    error?: string;
  },
  firmId: string = FIRM_ID,
): Promise<OracleAITask | null> {
  const data: {
    status?: string;
    progress?: number;
    result?: string;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
  } = {};
  if (input.status !== undefined) {
    data.status = input.status;
    if (input.status === 'running') data.startedAt = new Date();
    if (input.status === 'completed' || input.status === 'failed' || input.status === 'cancelled') {
      data.completedAt = new Date();
      data.progress = input.status === 'completed' ? 100 : (data.progress ?? 0);
    }
  }
  if (input.progress !== undefined) data.progress = Math.max(0, Math.min(100, input.progress));
  if (input.result !== undefined) data.result = JSON.stringify(input.result);
  if (input.error !== undefined) data.error = input.error;
  const row = await db.oracleAITask
    .update({ where: { id: taskId }, data })
    .catch(() => null);
  if (!row) return null;
  return serializeTask(row);
}

export async function cancelTask(taskId: string, firmId: string = FIRM_ID): Promise<OracleAITask | null> {
  return updateTask(taskId, { status: 'cancelled' }, firmId);
}

export async function getTaskStats(firmId: string = FIRM_ID): Promise<{
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}> {
  const rows = await db.oracleAITask.groupBy({
    by: ['status'],
    where: { firmId },
    _count: true,
  });
  const stats = { total: 0, queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
  for (const r of rows) {
    const count = r._count;
    stats.total += count;
    if (r.status === 'queued') stats.queued += count;
    if (r.status === 'running') stats.running += count;
    if (r.status === 'completed') stats.completed += count;
    if (r.status === 'failed') stats.failed += count;
    if (r.status === 'cancelled') stats.cancelled += count;
  }
  return stats;
}
