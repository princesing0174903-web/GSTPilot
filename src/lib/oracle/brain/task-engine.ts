// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Task Engine (PROMPT 6)
//
// Autonomous task lifecycle: Create → Reminder → Follow-up → Complete.
// Tasks can be created manually by the user or autonomously by Oracle when it
// detects a business condition (overdue invoice, upcoming GST, low cash).
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  BrainTask,
  TaskType,
  TaskStatus,
  TaskPriority,
} from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

interface TaskRow {
  id: string;
  firmId: string;
  userId: string | null;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  relatedType: string | null;
  relatedId: string | null;
  relatedLabel: string | null;
  dueDate: Date | null;
  reminderSentAt: Date | null;
  followUpSentAt: Date | null;
  completedAt: Date | null;
  completedBy: string | null;
  completionNote: string | null;
  sourceMemoryId: string | null;
  autonomous: boolean;
  metadata: string;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: TaskRow): BrainTask {
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
    description: row.description,
    type: row.type as TaskType,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    relatedType: row.relatedType,
    relatedId: row.relatedId,
    relatedLabel: row.relatedLabel,
    dueDate: row.dueDate?.toISOString() ?? null,
    reminderSentAt: row.reminderSentAt?.toISOString() ?? null,
    followUpSentAt: row.followUpSentAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    completedBy: row.completedBy,
    completionNote: row.completionNote,
    sourceMemoryId: row.sourceMemoryId,
    autonomous: row.autonomous,
    metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function sortTasks(tasks: BrainTask[]): BrainTask[] {
  return tasks.sort((a, b) => {
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr !== 0) return pr;
    const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (ad !== bd) return ad - bd;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CreateTaskInput {
  firmId: string;
  userId?: string;
  title: string;
  description?: string;
  type?: TaskType;
  priority?: TaskPriority;
  relatedType?: string;
  relatedId?: string;
  relatedLabel?: string;
  dueDate?: Date;
  sourceMemoryId?: string;
  autonomous?: boolean;
  metadata?: Record<string, unknown>;
}

/** Create a new task. */
export async function createTask(input: CreateTaskInput): Promise<BrainTask> {
  try {
    const row = await db.oracleBrainTask.create({
      data: {
        firmId: input.firmId,
        userId: input.userId ?? null,
        title: input.title,
        description: input.description ?? '',
        type: input.type ?? 'custom',
        status: 'pending',
        priority: input.priority ?? 'medium',
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId ?? null,
        relatedLabel: input.relatedLabel ?? null,
        dueDate: input.dueDate ?? null,
        sourceMemoryId: input.sourceMemoryId ?? null,
        autonomous: input.autonomous ?? false,
        metadata: JSON.stringify(input.metadata ?? {}),
      },
    });
    return mapRow(row as unknown as TaskRow);
  } catch (err) {
    throw new Error(
      `createTask failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Patch task fields. */
export async function updateTask(
  id: string,
  patch: Partial<{
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: Date | null;
    relatedId: string;
    relatedLabel: string;
    completionNote: string;
    completedBy: string;
  }>,
): Promise<BrainTask> {
  try {
    const row = await db.oracleBrainTask.update({
      where: { id },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
        ...(patch.relatedId !== undefined ? { relatedId: patch.relatedId } : {}),
        ...(patch.relatedLabel !== undefined ? { relatedLabel: patch.relatedLabel } : {}),
        ...(patch.completionNote !== undefined ? { completionNote: patch.completionNote } : {}),
        ...(patch.completedBy !== undefined ? { completedBy: patch.completedBy } : {}),
      },
    });
    return mapRow(row as unknown as TaskRow);
  } catch (err) {
    throw new Error(
      `updateTask failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Fetch a single task. */
export async function getTask(id: string): Promise<BrainTask | null> {
  try {
    const row = await db.oracleBrainTask.findUnique({ where: { id } });
    return row ? mapRow(row as unknown as TaskRow) : null;
  } catch (err) {
    throw new Error(
      `getTask failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** List tasks with filters. */
export async function listTasks(opts: {
  firmId: string;
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority;
  type?: TaskType;
  limit?: number;
  offset?: number;
}): Promise<BrainTask[]> {
  try {
    const where: Record<string, unknown> = { firmId: opts.firmId };
    if (opts.status) {
      where.status = Array.isArray(opts.status) ? { in: opts.status } : opts.status;
    }
    if (opts.priority) where.priority = opts.priority;
    if (opts.type) where.type = opts.type;
    const rows = await db.oracleBrainTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 50,
      skip: opts.offset ?? 0,
    });
    return sortTasks(rows.map((r) => mapRow(r as unknown as TaskRow)));
  } catch (err) {
    throw new Error(
      `listTasks failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Mark a task completed. */
export async function completeTask(
  id: string,
  completedBy: string,
  completionNote?: string,
): Promise<BrainTask> {
  try {
    const row = await db.oracleBrainTask.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        completedBy,
        completionNote: completionNote ?? null,
      },
    });
    return mapRow(row as unknown as TaskRow);
  } catch (err) {
    throw new Error(
      `completeTask failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Cancel a task. */
export async function cancelTask(id: string): Promise<BrainTask> {
  try {
    const row = await db.oracleBrainTask.update({
      where: { id },
      data: { status: 'cancelled' },
    });
    return mapRow(row as unknown as TaskRow);
  } catch (err) {
    throw new Error(
      `cancelTask failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Mark reminder sent (only if currently pending). */
export async function markReminderSent(id: string): Promise<BrainTask> {
  try {
    const existing = await db.oracleBrainTask.findUnique({
      where: { id },
      select: { status: true },
    });
    if (existing?.status === 'pending') {
      const row = await db.oracleBrainTask.update({
        where: { id },
        data: { status: 'reminder_sent', reminderSentAt: new Date() },
      });
      return mapRow(row as unknown as TaskRow);
    }
    const row = await db.oracleBrainTask.findUnique({ where: { id } });
    return mapRow(row as unknown as TaskRow);
  } catch (err) {
    throw new Error(
      `markReminderSent failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Mark follow-up sent. */
export async function markFollowUpSent(id: string): Promise<BrainTask> {
  try {
    const existing = await db.oracleBrainTask.findUnique({
      where: { id },
      select: { status: true },
    });
    if (existing?.status === 'pending' || existing?.status === 'reminder_sent') {
      const row = await db.oracleBrainTask.update({
        where: { id },
        data: { status: 'follow_up', followUpSentAt: new Date() },
      });
      return mapRow(row as unknown as TaskRow);
    }
    const row = await db.oracleBrainTask.findUnique({ where: { id } });
    return mapRow(row as unknown as TaskRow);
  } catch (err) {
    throw new Error(
      `markFollowUpSent failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Get overdue tasks. */
export async function getOverdueTasks(firmId: string): Promise<BrainTask[]> {
  try {
    const rows = await db.oracleBrainTask.findMany({
      where: {
        firmId,
        dueDate: { lt: new Date() },
        status: { in: ['pending', 'in_progress', 'reminder_sent', 'follow_up'] },
      },
      orderBy: { dueDate: 'asc' },
    });
    return sortTasks(rows.map((r) => mapRow(r as unknown as TaskRow)));
  } catch (err) {
    throw new Error(
      `getOverdueTasks failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Get all non-completed, non-cancelled tasks. */
export async function getPendingTasks(
  firmId: string,
  limit = 20,
): Promise<BrainTask[]> {
  try {
    const rows = await db.oracleBrainTask.findMany({
      where: {
        firmId,
        status: { notIn: ['completed', 'cancelled'] },
      },
      orderBy: { createdAt: 'desc' },
      take: limit * 3,
    });
    return sortTasks(rows.map((r) => mapRow(r as unknown as TaskRow))).slice(0, limit);
  } catch (err) {
    throw new Error(
      `getPendingTasks failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Translate an autonomous insight into a task. */
export async function createAutonomousTaskFromInsight(
  firmId: string,
  insight: {
    headline: string;
    detail: string;
    severity: 'info' | 'watch' | 'warn' | 'critical';
    actionPrompt?: string;
    relatedType?: string;
    relatedId?: string;
    relatedLabel?: string;
    dueDate?: Date;
    sourceMemoryId?: string;
  },
): Promise<BrainTask> {
  const severityToPriority: Record<string, TaskPriority> = {
    critical: 'critical',
    warn: 'high',
    watch: 'medium',
    info: 'low',
  };
  const priority = severityToPriority[insight.severity] ?? 'medium';

  const action = (insight.actionPrompt ?? '').toLowerCase();
  let type: TaskType = 'custom';
  if (action.includes('collect') || action.includes('payment')) type = 'collect_payment';
  else if (action.includes('report')) type = 'generate_report';
  else if (action.includes('gst') || action.includes('gstr') || action.includes('file')) type = 'file_gst';
  else if (action.includes('call') || action.includes('client')) type = 'call_client';
  else if (action.includes('vendor') || action.includes('review')) type = 'review_vendor';

  return createTask({
    firmId,
    title: insight.headline,
    description: insight.detail,
    type,
    priority,
    relatedType: insight.relatedType,
    relatedId: insight.relatedId,
    relatedLabel: insight.relatedLabel,
    dueDate: insight.dueDate,
    sourceMemoryId: insight.sourceMemoryId,
    autonomous: true,
  });
}

/** Aggregate task counts. */
export async function getTaskStats(
  firmId: string,
): Promise<{
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  byPriority: Record<TaskPriority, number>;
}> {
  try {
    const rows = await db.oracleBrainTask.findMany({
      where: { firmId },
      select: { status: true, priority: true, dueDate: true },
    });
    const now = Date.now();
    const byPriority: Record<TaskPriority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let overdue = 0;
    for (const r of rows) {
      byPriority[r.priority as TaskPriority] =
        (byPriority[r.priority as TaskPriority] ?? 0) + 1;
      if (r.status === 'pending') pending++;
      else if (r.status === 'in_progress' || r.status === 'reminder_sent' || r.status === 'follow_up') inProgress++;
      else if (r.status === 'completed') completed++;
      if (
        r.dueDate &&
        r.dueDate.getTime() < now &&
        !['completed', 'cancelled'].includes(r.status)
      ) {
        overdue++;
      }
    }
    return { total: rows.length, pending, inProgress, completed, overdue, byPriority };
  } catch (err) {
    throw new Error(
      `getTaskStats failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
